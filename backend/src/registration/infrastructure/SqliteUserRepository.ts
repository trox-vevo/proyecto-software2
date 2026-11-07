import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { NewUser, User } from "../domain/User";
import { DuplicateEmailError, type UserRepository } from "../domain/UserRepository";
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
}

// US02: email es unico a nivel de base de datos, no solo en el frontend.
export class SqliteUserRepository implements UserRepository {
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
      this.database.exec("PRAGMA busy_timeout = 5000");
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
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  findByEmail(email: string): User | null {
    const query = this.database.prepare("SELECT id, username, email, password_hash, plan, created_at FROM users WHERE email = ?");
    query.setReadBigInts(true);
    const row = query.get(email) as unknown as UserRow | undefined;
    return row
      ? {
          id: numericIdentifier(row.id),
          username: row.username,
          email: row.email,
          passwordHash: row.password_hash,
          plan: "BASICO",
          createdAt: row.created_at,
        }
      : null;
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

  close(): void {
    this.database.close();
  }
}
