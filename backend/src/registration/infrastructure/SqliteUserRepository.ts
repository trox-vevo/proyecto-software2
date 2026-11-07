import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { User } from "../domain/User";
import { DuplicateEmailError, type UserRepository } from "../domain/UserRepository";
import type {
  NewRecoveryToken,
  RecoveryTokenRepository,
} from "../../recovery/domain/RecoveryTokenRepository";

// US02: email es unico a nivel de base de datos, no solo en el frontend.
export class SqliteUserRepository implements UserRepository, RecoveryTokenRepository {
  private readonly database: DatabaseSync;

  constructor(filePath = "data/usuarios.sqlite") {
    if (filePath !== ":memory:") mkdirSync(dirname(filePath), { recursive: true });
    this.database = new DatabaseSync(filePath);
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'BASICO',
        created_at TEXT NOT NULL
      )
    `);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS password_recovery_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);
    this.migrateTextUserIds();
  }

  private migrateTextUserIds(): void {
    const userIdColumn = this.database
      .prepare("PRAGMA table_info(users)")
      .all()
      .find((column) => (column as { name?: string }).name === "id") as
      | { type: string }
      | undefined;
    if (userIdColumn?.type.toUpperCase() === "INTEGER") return;

    this.database.exec("PRAGMA foreign_keys = OFF");
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec(`
        CREATE TABLE users_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          password_hash TEXT NOT NULL,
          plan TEXT NOT NULL DEFAULT 'BASICO',
          created_at TEXT NOT NULL
        );
        CREATE TABLE password_recovery_tokens_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users_v2(id),
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);

      const users = this.database
        .prepare("SELECT id, username, email, password_hash, plan, created_at FROM users ORDER BY rowid")
        .all() as {
          id: string;
          username: string;
          email: string;
          password_hash: string;
          plan: string;
          created_at: string;
        }[];
      const userIds = new Map<string, number>();
      const insertUser = this.database.prepare(
        "INSERT INTO users_v2 (username, email, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?)",
      );
      for (const user of users) {
        const result = insertUser.run(
          user.username,
          user.email,
          user.password_hash,
          user.plan,
          user.created_at,
        );
        userIds.set(user.id, Number(result.lastInsertRowid));
      }

      const tokens = this.database
        .prepare(
          "SELECT id, user_id, token_hash, expires_at, used, created_at FROM password_recovery_tokens ORDER BY id",
        )
        .all() as {
          id: number;
          user_id: string;
          token_hash: string;
          expires_at: string;
          used: number;
          created_at: string;
        }[];
      const insertToken = this.database.prepare(
        "INSERT INTO password_recovery_tokens_v2 (id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      );
      for (const token of tokens) {
        const newUserId = userIds.get(token.user_id);
        if (newUserId === undefined) {
          throw new Error(`Token de recuperación asociado a un usuario inexistente: ${token.id}`);
        }
        insertToken.run(
          token.id,
          newUserId,
          token.token_hash,
          token.expires_at,
          token.used,
          token.created_at,
        );
      }

      this.database.exec(`
        DROP TABLE password_recovery_tokens;
        DROP TABLE users;
        ALTER TABLE users_v2 RENAME TO users;
        ALTER TABLE password_recovery_tokens_v2 RENAME TO password_recovery_tokens;
      `);
      this.database.exec("COMMIT");
    } catch (error: unknown) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      this.database.exec("PRAGMA foreign_keys = ON");
    }
  }

  findByEmail(email: string): User | null {
    const row = this.database
      .prepare("SELECT id, username, email, password_hash, plan, created_at FROM users WHERE email = ?")
      .get(email) as
      | {
          id: number;
          username: string;
          email: string;
          password_hash: string;
          plan: string;
          created_at: string;
        }
      | undefined;
    if (!row) return null;
    if (row.plan !== "BASICO" && row.plan !== "PRO") {
      throw new Error(`Plan de usuario inválido en la base de datos: ${String(row.plan)}`);
    }
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      plan: row.plan,
      createdAt: row.created_at,
    };
  }

  create(user: Omit<User, "id">): User {
    try {
      const result = this.database
        .prepare("INSERT INTO users (username, email, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(user.username, user.email, user.passwordHash, user.plan, user.createdAt);
      return { ...user, id: Number(result.lastInsertRowid) };
    } catch (error: unknown) {
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
      .run(userId, exceptId ?? null, exceptId ?? null);
  }

  createRecoveryToken(token: NewRecoveryToken): number {
    const result = this.database
      .prepare(
        "INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(token.userId, token.tokenHash, token.expiresAt, new Date().toISOString());
    return Number(result.lastInsertRowid);
  }

  deleteRecoveryToken(id: number): void {
    this.database.prepare("DELETE FROM password_recovery_tokens WHERE id = ?").run(id);
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
      const token = this.database
        .prepare(
          "SELECT id, user_id FROM password_recovery_tokens WHERE token_hash = ? AND used = 0 AND expires_at > ?",
        )
        .get(tokenHash, now) as { id: number; user_id: number } | undefined;

      if (!token) {
        this.database.exec("ROLLBACK");
        return false;
      }

      const updated = this.database
        .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .run(passwordHash, token.user_id);
      if (updated.changes !== 1) {
        this.database.exec("ROLLBACK");
        return false;
      }

      this.database
        .prepare("UPDATE password_recovery_tokens SET used = 1 WHERE user_id = ? AND used = 0")
        .run(token.user_id);
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
