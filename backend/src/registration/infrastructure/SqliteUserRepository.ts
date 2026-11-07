import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { NewUser, User } from "../domain/User";
import { DuplicateEmailError, type UserRepository } from "../domain/UserRepository";
import type { NewRecoveryToken, RecoveryTokenRepository } from "../../recovery/domain/RecoveryTokenRepository";
import { numericIdentifier } from "../domain/NumericIdentifier";

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
}

// US02: email es unico a nivel de base de datos, no solo en el frontend.
export class SqliteUserRepository implements UserRepository, RecoveryTokenRepository {
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
          created_at TEXT NOT NULL
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
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  findByEmail(email: string): User | null {
    const query = this.database.prepare("SELECT id, username, email, password_hash, plan, created_at FROM users WHERE email = ?");
    query.setReadBigInts(true);
    const row = query.get(email) as unknown as UserRow | undefined;
    if (row && row.plan !== "BASICO" && row.plan !== "PRO") {
      throw new Error(`Plan de usuario inválido en la base de datos: ${String(row.plan)}`);
    }
    return row
      ? {
          id: numericIdentifier(row.id),
          username: row.username,
          email: row.email,
          passwordHash: row.password_hash,
          plan: row.plan as User["plan"],
          createdAt: row.created_at,
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
      const saved: User = { ...user, id: numericIdentifier(result.lastInsertRowid) };
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
