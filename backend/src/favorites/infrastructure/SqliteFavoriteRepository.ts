import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { FavoriteError, isEntityId, type Favorite, type FavoriteRepository, type NewFavorite } from "../domain/Favorite";

interface ColumnInfo {
  name: string;
  type: string;
  pk: number;
  notnull: number;
}

function readEntityId(value: unknown): number {
  if (typeof value === "bigint" && value > 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  if (isEntityId(value)) return value;
  throw new FavoriteError(503, "ENTITY_ID_OUT_OF_RANGE", "El identificador almacenado excede el contrato numérico seguro del sistema.");
}

export class SqliteFavoriteRepository implements FavoriteRepository {
  private readonly database: DatabaseSync;
  private readonly schemaIssue: FavoriteError | null;

  constructor(filePath: string) {
    if (filePath !== ":memory:") mkdirSync(dirname(filePath), { recursive: true });
    this.database = new DatabaseSync(filePath);
    this.database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    // Una base UUID necesita el procedimiento explícito de migración. No se altera aquí.
    this.schemaIssue = this.hasCompatibleSchema() ? null : new FavoriteError(
      503, "NUMERIC_ID_MIGRATION_REQUIRED", "La base de usuarios y favoritos requiere la migración autorizada a identificadores numéricos.",
    );
    if (this.schemaIssue) return;
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS favorite_simulations (
        id INTEGER PRIMARY KEY CONSTRAINT favorite_id_safe CHECK (id BETWEEN 1 AND 9007199254740991),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
          CONSTRAINT favorite_user_id_safe CHECK (user_id BETWEEN 1 AND 9007199254740991),
        fingerprint TEXT NOT NULL,
        instrument TEXT NOT NULL CHECK (instrument IN ('AHORROS', 'PLAZO_FIJO')),
        parameters_json TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, fingerprint)
      );
    `);
  }

  save(favorite: NewFavorite): { favorite: Favorite; created: boolean } {
    if (this.schemaIssue) throw this.schemaIssue;
    if (!isEntityId(favorite.userId)) throw new FavoriteError(401, "AUTHENTICATION_REQUIRED", "La identidad del usuario debe contener un identificador numérico válido.");
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const saved = this.insertOrFind(favorite);
      this.database.exec("COMMIT");
      return saved;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private hasCompatibleSchema(): boolean {
    const users = this.database.prepare("PRAGMA table_info(users)").all() as unknown as ColumnInfo[];
    const favorites = this.database.prepare("PRAGMA table_info(favorite_simulations)").all() as unknown as ColumnInfo[];
    const integerPrimaryKey = (table: "users" | "favorite_simulations", columns: ColumnInfo[]) => columns.filter((column) => column.pk > 0).length === 1
      && columns.some((column) => column.name === "id" && column.type.toUpperCase() === "INTEGER" && column.pk === 1)
      // INTEGER PRIMARY KEY DESC y WITHOUT ROWID tienen índice pk: no son alias rowid autogenerados.
      && !this.database.prepare(`PRAGMA index_list(${table})`).all().some((index) => index.origin === "pk");
    if (users.length && !integerPrimaryKey("users", users)) return false;
    if (!favorites.length) return true;
    if (!integerPrimaryKey("favorite_simulations", favorites) || !favorites.some((column) => column.name === "user_id" && column.type.toUpperCase() === "INTEGER")) return false;
    if (!["user_id", "fingerprint", "instrument", "parameters_json", "snapshot_json", "created_at"].every(
      (name) => favorites.some((column) => column.name === name && column.notnull === 1),
    )) return false;
    const foreignKeys = this.database.prepare("PRAGMA foreign_key_list(favorite_simulations)").all();
    if (!foreignKeys.some((key) => key.table === "users" && key.from === "user_id" && key.to === "id" && key.on_delete === "CASCADE")) return false;
    const indexes = this.database.prepare("PRAGMA index_list(favorite_simulations)").all();
    return indexes.some((index) => index.unique === 1 && index.partial === 0 && this.database.prepare(
      "SELECT name FROM pragma_index_info(?) ORDER BY seqno",
    ).all(index.name as string).map((column) => column.name).join(",") === "user_id,fingerprint");
  }

  private insertOrFind(favorite: NewFavorite): { favorite: Favorite; created: boolean } {
    const usersExist = this.database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
    if (!usersExist || !this.database.prepare("SELECT 1 FROM users WHERE id = ?").get(favorite.userId)) {
      throw new FavoriteError(503, "USER_PERSISTENCE_REQUIRED", "El guardado requiere integrar la cuenta con la base de datos de usuarios.");
    }

    const select = this.database.prepare(`
      SELECT id, user_id, fingerprint, parameters_json, snapshot_json, created_at
      FROM favorite_simulations WHERE user_id = ? AND fingerprint = ?
    `);
    select.setReadBigInts(true);
    const existing = select.get(favorite.userId, favorite.fingerprint);
    // El reintento sigue funcionando incluso cuando ya se agotó el rango de IDs.
    if (existing) return { created: false, favorite: this.readFavorite(existing) };

    const insert = this.database.prepare(`
      INSERT INTO favorite_simulations
        (user_id, fingerprint, instrument, parameters_json, snapshot_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, fingerprint) DO NOTHING
    `);
    let changes: number | bigint;
    try {
      changes = insert.run(
        favorite.userId, favorite.fingerprint, favorite.parameters.instrument,
        JSON.stringify(favorite.parameters), JSON.stringify(favorite.snapshot), favorite.createdAt,
      ).changes;
    } catch (error) {
      if (error instanceof Error && error.message.includes("favorite_id_safe")) {
        throw new FavoriteError(503, "ENTITY_ID_OUT_OF_RANGE", "Se alcanzó el límite de identificadores numéricos seguros para favoritos.");
      }
      throw error;
    }
    const row = select.get(favorite.userId, favorite.fingerprint)!;

    return {
      created: changes === 1 || changes === 1n,
      favorite: this.readFavorite(row),
    };
  }

  private readFavorite(row: Record<string, unknown>): Favorite {
    return {
      id: readEntityId(row.id),
      userId: readEntityId(row.user_id),
      fingerprint: row.fingerprint as string,
      parameters: JSON.parse(row.parameters_json as string) as Favorite["parameters"],
      snapshot: JSON.parse(row.snapshot_json as string),
      createdAt: row.created_at as string,
    };
  }

  close(): void {
    this.database.close();
  }
}
