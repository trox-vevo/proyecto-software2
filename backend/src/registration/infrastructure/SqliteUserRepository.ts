import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { User } from "../domain/User";
import { DuplicateEmailError, type UserRepository } from "../domain/UserRepository";

// US02: email es unico a nivel de base de datos, no solo en el frontend.
export class SqliteUserRepository implements UserRepository {
  private readonly database: DatabaseSync;

  constructor(filePath = "data/usuarios.sqlite") {
    if (filePath !== ":memory:") mkdirSync(dirname(filePath), { recursive: true });
    this.database = new DatabaseSync(filePath);
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

  close(): void {
    this.database.close();
  }
}
