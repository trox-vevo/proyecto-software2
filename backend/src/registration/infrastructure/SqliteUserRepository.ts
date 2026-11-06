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
        id TEXT PRIMARY KEY,
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
        user_id TEXT NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);
  }

  findByEmail(email: string): User | null {
    const row = this.database
      .prepare("SELECT id, username, email, password_hash, plan, created_at FROM users WHERE email = ?")
      .get(email) as Record<string, string> | undefined;
    return row
      ? {
          id: row.id,
          username: row.username,
          email: row.email,
          passwordHash: row.password_hash,
          plan: "BASICO",
          createdAt: row.created_at,
        }
      : null;
  }

  create(user: User): User {
    try {
      this.database
        .prepare("INSERT INTO users (id, username, email, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(user.id, user.username, user.email, user.passwordHash, user.plan, user.createdAt);
      return user;
    } catch (error: unknown) {
      const sqlError = error as { code?: unknown; errcode?: unknown; message?: unknown } | null;
      if (sqlError?.errcode === 2067 || (sqlError?.code === "ERR_SQLITE_ERROR" &&
          typeof sqlError.message === "string" && sqlError.message.includes("UNIQUE constraint failed: users.email"))) {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }

  invalidateRecoveryTokens(userId: string, exceptId?: number): void {
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
        .get(tokenHash, now) as { id: number; user_id: string } | undefined;

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
