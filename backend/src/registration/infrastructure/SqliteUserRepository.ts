import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { NewUser, User } from "../domain/User";
import { DuplicateEmailError, type UserRepository } from "../domain/UserRepository";
import type { NewRecoveryToken, RecoveryTokenRepository } from "../../recovery/domain/RecoveryTokenRepository";
import { numericIdentifier } from "../domain/NumericIdentifier";
import type {
  PlanChangeHistoryEntry,
  PendingPlanChangeNotification,
  RenewalPaymentFailureEvent,
  SubscriptionMaintenanceRepository,
} from "../../subscription/domain/SubscriptionMaintenanceRepository";

export class UserSchemaMigrationRequiredError extends Error {
  constructor() {
    super("La base de usuarios requiere una migración explícita a identificadores INTEGER PRIMARY KEY. No se modificó su esquema.");
    this.name = "UserSchemaMigrationRequiredError";
  }
}

interface UserRow {
  id: bigint;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
  plan: unknown;
  plan_expires_at: string | null;
  plan_cancel_at_period_end: bigint;
}

// US02: email es unico a nivel de base de datos, no solo en el frontend.
export class SqliteUserRepository implements UserRepository, RecoveryTokenRepository, SubscriptionMaintenanceRepository {
  private readonly database: DatabaseSync;

  constructor(filePath = "data/usuarios.sqlite") {
    if (filePath !== ":memory:") mkdirSync(dirname(filePath), { recursive: true });
    this.database = new DatabaseSync(filePath);
    try {
      const columns = this.database.prepare("PRAGMA table_info(users)").all();
      if (columns.length) {
        const primaryKeys = columns.filter((column) => column.pk !== 0);
        // Una PK INTEGER de una sola columna debe ser alias de rowid para autogenerarse.
        const primaryKeyIndex = this.database.prepare("PRAGMA index_list(users)").all().some((index) => index.origin === "pk");
        if (primaryKeys.length !== 1 || primaryKeys[0].name !== "id" ||
            String(primaryKeys[0].type).toUpperCase() !== "INTEGER" || primaryKeyIndex) {
          throw new UserSchemaMigrationRequiredError();
        }
      }
      const recoveryColumns = this.database.prepare("PRAGMA table_info(password_recovery_tokens)").all();
      if (recoveryColumns.length && ["id", "user_id"].some((name) => {
        const column = recoveryColumns.find((item) => item.name === name);
        return !column || String(column.type).toUpperCase() !== "INTEGER";
      })) {
        throw new UserSchemaMigrationRequiredError();
      }
      this.database.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON");
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 9007199254740991),
          username TEXT NOT NULL,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'BASICO',
          created_at TEXT NOT NULL,
          plan_cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK(plan_cancel_at_period_end IN (0, 1))
        )
      `);
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS password_recovery_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id BETWEEN 1 AND 9007199254740991),
          user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `);
      // US33: CREATE TABLE IF NOT EXISTS no agrega columnas a bases anteriores.
      const hasExpiry = this.database.prepare("PRAGMA table_info(users)").all()
        .some((column) => column.name === "plan_expires_at");
      if (!hasExpiry) this.database.exec("ALTER TABLE users ADD COLUMN plan_expires_at TEXT");
      const hasCancellationRequest = this.database.prepare("PRAGMA table_info(users)").all()
        .some((column) => column.name === "plan_cancel_at_period_end");
      if (!hasCancellationRequest) {
        this.database.exec("ALTER TABLE users ADD COLUMN plan_cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK(plan_cancel_at_period_end IN (0, 1))");
      }
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS plan_change_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id BETWEEN 1 AND 9007199254740991),
          user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
          email TEXT NOT NULL,
          plan_expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          sent_at TEXT,
          reason TEXT NOT NULL DEFAULT 'PERIOD_EXPIRED'
            CHECK(reason IN ('PERIOD_EXPIRED', 'RENEWAL_PAYMENT_FAILED')),
          UNIQUE(user_id, plan_expires_at)
        )
      `);
      const notificationColumns = this.database.prepare("PRAGMA table_info(plan_change_notifications)").all();
      if (!notificationColumns.some((column) => column.name === "reason")) {
        this.database.exec(
          "ALTER TABLE plan_change_notifications ADD COLUMN reason TEXT NOT NULL DEFAULT 'PERIOD_EXPIRED' CHECK(reason IN ('PERIOD_EXPIRED', 'RENEWAL_PAYMENT_FAILED'))",
        );
      }
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS plan_change_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id BETWEEN 1 AND 9007199254740991),
          user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
          from_plan TEXT NOT NULL CHECK(from_plan = 'PRO'),
          to_plan TEXT NOT NULL CHECK(to_plan = 'BASICO'),
          reason TEXT NOT NULL CHECK(reason IN ('PERIOD_EXPIRED', 'RENEWAL_PAYMENT_FAILED')),
          changed_at TEXT NOT NULL,
          plan_expires_at TEXT NOT NULL,
          event_id TEXT UNIQUE
        );
        CREATE TABLE IF NOT EXISTS subscription_payment_failure_events (
          event_id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
          period_expires_at TEXT NOT NULL,
          occurred_at TEXT NOT NULL
        )
      `);
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  findByEmail(email: string): User | null {
    const query = this.database.prepare("SELECT id, username, email, password_hash, plan, created_at, plan_expires_at, plan_cancel_at_period_end FROM users WHERE email = ?");
    query.setReadBigInts(true);
    const row = query.get(email) as unknown as UserRow | undefined;
    if (row && row.plan !== "BASICO" && row.plan !== "PRO") {
      throw new Error(`Plan de usuario inválido en la base de datos: ${String(row.plan)}`);
    }
    if (row && row.plan_cancel_at_period_end !== 0n && row.plan_cancel_at_period_end !== 1n) {
      throw new Error("Estado de cancelación inválido en la base de datos.");
    }
    const expiresAt = row?.plan_expires_at || null;
    const expiration = expiresAt === null ? null : Date.parse(expiresAt);
    const plan = row?.plan === "PRO" && expiresAt !== null &&
      (expiration === null || !Number.isFinite(expiration) || expiration <= Date.now())
      ? "BASICO"
      : row?.plan;
    return row
      ? {
          id: numericIdentifier(row.id),
          username: row.username,
          email: row.email,
          passwordHash: row.password_hash,
          plan: plan as User["plan"],
          createdAt: row.created_at,
          planExpiresAt: expiresAt,
          planCancellationRequested: row.plan_cancel_at_period_end === 1n,
        }
      : null;
  }

  findById(id: number): User | null {
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const row = this.database.prepare("SELECT email FROM users WHERE id = ?").get(id) as { email: string } | undefined;
    // Reutiliza el mapeo y la validación de planes del repositorio existente.
    return row ? this.findByEmail(row.email) : null;
  }

  create(user: NewUser): User {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      // Conserva la duplicidad incluso cuando el siguiente rowid agotaría el rango seguro.
      // La reserva de escritura evita carreras; UNIQUE sigue siendo la defensa definitiva.
      if (this.database.prepare("SELECT 1 FROM users WHERE email = ?").get(user.email)) {
        throw new DuplicateEmailError();
      }
      const insert = this.database.prepare("INSERT INTO users (username, email, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?)");
      insert.setReadBigInts(true);
      const result = insert.run(user.username, user.email, user.passwordHash, user.plan, user.createdAt);
      const saved: User = { ...user, id: numericIdentifier(result.lastInsertRowid), planExpiresAt: null };
      this.database.exec("COMMIT");
      return saved;
    } catch (error: unknown) {
      this.database.exec("ROLLBACK");
      const sqlError = error as { code?: unknown; errcode?: unknown; message?: unknown } | null;
      if (sqlError?.errcode === 2067 || (sqlError?.code === "ERR_SQLITE_ERROR" &&
          typeof sqlError.message === "string" && sqlError.message.includes("UNIQUE constraint failed: users.email"))) {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }

  activatePro(id: number, expiresAt: string): void {
    // Un solo UPDATE: plan, vencimiento y solicitud de cancelación cambian juntos.
    const result = this.database
      .prepare("UPDATE users SET plan = 'PRO', plan_expires_at = ?, plan_cancel_at_period_end = 0 WHERE id = ?")
      .run(expiresAt, numericIdentifier(id));
    if (result.changes !== 1) throw new Error("No se pudo activar el Plan Pro.");
  }

  requestProCancellation(id: number): void {
    const result = this.database
      .prepare("UPDATE users SET plan_cancel_at_period_end = 1 WHERE id = ? AND plan = 'PRO' AND plan_cancel_at_period_end = 0")
      .run(numericIdentifier(id));
    if (result.changes !== 1) throw new Error("No se pudo programar la cancelación del Plan Pro.");
  }

  processDueProDowngrades(now: string): void {
    const nowTime = Date.parse(now);
    if (!Number.isFinite(nowTime)) throw new RangeError("La fecha de mantenimiento no es válida.");
    const nowIso = new Date(nowTime).toISOString();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const query = this.database.prepare(
        "SELECT id, email, plan_expires_at FROM users WHERE plan = 'PRO' AND plan_expires_at IS NOT NULL AND plan_expires_at <= ?",
      );
      query.setReadBigInts(true);
      const expired = query.all(nowIso) as unknown as Array<{
        id: bigint;
        email: string;
        plan_expires_at: string;
      }>;
      const update = this.database.prepare(
        "UPDATE users SET plan = 'BASICO', plan_expires_at = NULL, plan_cancel_at_period_end = 0 WHERE id = ? AND plan = 'PRO' AND plan_expires_at <= ?",
      );
      for (const user of expired) {
        const userId = numericIdentifier(user.id);
        const result = update.run(userId, nowIso);
        if (result.changes !== 1) continue;
        this.savePlanChange(userId, user.email, user.plan_expires_at, "PERIOD_EXPIRED", nowIso);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  recordRenewalPaymentFailure(
    event: RenewalPaymentFailureEvent,
  ): "DEGRADED" | "ALREADY_PROCESSED" | "NOT_ACTIVE" {
    if (!Number.isSafeInteger(event.userId) || event.userId <= 0) {
      throw new RangeError("El usuario del evento de pago no es válido.");
    }
    if (!event.eventId.trim() || event.eventId.length > 200) {
      throw new RangeError("El identificador del evento de pago no es válido.");
    }
    const periodExpiration = Date.parse(event.periodExpiresAt);
    const occurred = Date.parse(event.occurredAt);
    if (!Number.isFinite(periodExpiration) || !Number.isFinite(occurred)) {
      throw new RangeError("Las fechas del evento de pago no son válidas.");
    }
    const periodExpiresAt = new Date(periodExpiration).toISOString();
    const occurredAt = new Date(occurred).toISOString();
    const userId = numericIdentifier(event.userId);

    this.database.exec("BEGIN IMMEDIATE");
    try {
      if (this.database.prepare(
        "SELECT 1 FROM subscription_payment_failure_events WHERE event_id = ?",
      ).get(event.eventId)) {
        this.database.exec("COMMIT");
        return "ALREADY_PROCESSED";
      }

      const query = this.database.prepare(
        "SELECT email FROM users WHERE id = ? AND plan = 'PRO' AND plan_expires_at = ?",
      );
      const user = query.get(userId, periodExpiresAt) as { email: string } | undefined;
      if (!user) {
        this.database.exec("ROLLBACK");
        return "NOT_ACTIVE";
      }

      this.database.prepare(
        "INSERT INTO subscription_payment_failure_events (event_id, user_id, period_expires_at, occurred_at) VALUES (?, ?, ?, ?)",
      ).run(event.eventId, userId, periodExpiresAt, occurredAt);
      const update = this.database.prepare(
        "UPDATE users SET plan = 'BASICO', plan_expires_at = NULL, plan_cancel_at_period_end = 0 WHERE id = ? AND plan = 'PRO' AND plan_expires_at = ?",
      ).run(userId, periodExpiresAt);
      if (update.changes !== 1) {
        this.database.exec("ROLLBACK");
        return "NOT_ACTIVE";
      }
      this.savePlanChange(
        userId,
        user.email,
        periodExpiresAt,
        "RENEWAL_PAYMENT_FAILED",
        occurredAt,
        event.eventId,
      );
      this.database.exec("COMMIT");
      return "DEGRADED";
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private savePlanChange(
    userId: number,
    email: string,
    planExpiresAt: string,
    reason: "PERIOD_EXPIRED" | "RENEWAL_PAYMENT_FAILED",
    changedAt: string,
    eventId?: string,
  ): void {
    this.database.prepare(
      "INSERT INTO plan_change_history (user_id, from_plan, to_plan, reason, changed_at, plan_expires_at, event_id) VALUES (?, 'PRO', 'BASICO', ?, ?, ?, ?)",
    ).run(userId, reason, changedAt, planExpiresAt, eventId ?? null);
    this.database.prepare(
      "INSERT INTO plan_change_notifications (user_id, email, plan_expires_at, created_at, reason) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, plan_expires_at) DO NOTHING",
    ).run(userId, email, planExpiresAt, changedAt, reason);
  }

  findPlanChangeHistory(userId: number): PlanChangeHistoryEntry[] {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new RangeError("El usuario del historial de suscripciones no es válido.");
    }
    const query = this.database.prepare(
      "SELECT id, from_plan, to_plan, reason, changed_at, plan_expires_at FROM plan_change_history WHERE user_id = ? ORDER BY changed_at DESC, id DESC",
    );
    query.setReadBigInts(true);
    const rows = query.all(numericIdentifier(userId)) as unknown as Array<{
      id: bigint;
      from_plan: "PRO";
      to_plan: "BASICO";
      reason: "PERIOD_EXPIRED" | "RENEWAL_PAYMENT_FAILED";
      changed_at: string;
      plan_expires_at: string;
    }>;
    return rows.map((row) => ({
      id: numericIdentifier(row.id),
      fromPlan: row.from_plan,
      toPlan: row.to_plan,
      reason: row.reason,
      changedAt: row.changed_at,
      planExpiresAt: row.plan_expires_at,
    }));
  }

  findPendingPlanChangeNotifications(): PendingPlanChangeNotification[] {
    const query = this.database.prepare(
      "SELECT id, user_id, email, plan_expires_at, reason, created_at FROM plan_change_notifications WHERE sent_at IS NULL ORDER BY id",
    );
    query.setReadBigInts(true);
    const rows = query.all() as unknown as Array<{
      id: bigint;
      user_id: bigint;
      email: string;
      plan_expires_at: string;
      reason: "PERIOD_EXPIRED" | "RENEWAL_PAYMENT_FAILED";
      created_at: string;
    }>;
    return rows.map((row) => ({
      id: numericIdentifier(row.id),
      userId: numericIdentifier(row.user_id),
      email: row.email,
      planExpiresAt: row.plan_expires_at,
      reason: row.reason,
      changedAt: row.created_at,
    }));
  }

  markPlanChangeNotificationSent(id: number, sentAt: string): void {
    const result = this.database
      .prepare("UPDATE plan_change_notifications SET sent_at = ? WHERE id = ? AND sent_at IS NULL")
      .run(sentAt, numericIdentifier(id));
    if (result.changes !== 1) throw new Error("No se pudo registrar el envío de la notificación de cambio de plan.");
  }

  invalidateRecoveryTokens(userId: number, exceptId?: number): void {
    this.database
      .prepare(
        "UPDATE password_recovery_tokens SET used = 1 WHERE user_id = ? AND used = 0 AND (? IS NULL OR id <> ?)",
      )
      .run(numericIdentifier(userId), exceptId === undefined ? null : numericIdentifier(exceptId), exceptId === undefined ? null : numericIdentifier(exceptId));
  }

  createRecoveryToken(token: NewRecoveryToken): number {
    const userId = numericIdentifier(token.userId);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const insert = this.database.prepare(
        "INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
      );
      insert.setReadBigInts(true);
      const result = insert.run(userId, token.tokenHash, token.expiresAt, new Date().toISOString());
      const id = numericIdentifier(result.lastInsertRowid);
      this.database.exec("COMMIT");
      return id;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  deleteRecoveryToken(id: number): void {
    this.database.prepare("DELETE FROM password_recovery_tokens WHERE id = ?").run(numericIdentifier(id));
  }

  hasValidRecoveryToken(tokenHash: string, now: string): boolean {
    const row = this.database
      .prepare(
        "SELECT 1 FROM password_recovery_tokens WHERE token_hash = ? AND used = 0 AND expires_at > ?",
      )
      .get(tokenHash, now);
    return row !== undefined;
  }

  updatePasswordWithRecoveryToken(
    tokenHash: string,
    passwordHash: string,
    now: string,
  ): boolean {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const query = this.database.prepare(
        "SELECT id, user_id FROM password_recovery_tokens WHERE token_hash = ? AND used = 0 AND expires_at > ?",
      );
      query.setReadBigInts(true);
      const token = query.get(tokenHash, now) as { id: bigint; user_id: bigint } | undefined;

      if (!token) {
        this.database.exec("ROLLBACK");
        return false;
      }

      numericIdentifier(token.id);
      const userId = numericIdentifier(token.user_id);
      const updated = this.database
        .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .run(passwordHash, userId);
      if (updated.changes !== 1) {
        this.database.exec("ROLLBACK");
        return false;
      }

      this.database
        .prepare("UPDATE password_recovery_tokens SET used = 1 WHERE user_id = ? AND used = 0")
        .run(userId);
      this.database.exec("COMMIT");
      return true;
    } catch (error: unknown) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}
