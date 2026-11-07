import { closeSync, existsSync, openSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { backup, DatabaseSync, type SQLOutputValue } from "node:sqlite";

const MAX_ID = BigInt(Number.MAX_SAFE_INTEGER);
type Row = Record<string, SQLOutputValue>;
type IdKind = "TEXT" | "INTEGER";

export interface NumericMigrationOptions {
  source: string;
  output: string;
  backup: string;
  applyCopy: true;
}

export interface NumericMigrationResult {
  users: number;
  favorites: number;
  recoveryTokens: number;
  sourceUnchanged: true;
  source: string;
  output: string;
  backup: string;
}

export class NumericMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NumericMigrationError";
  }
}

function fail(message: string): never {
  throw new NumericMigrationError(message);
}

function positiveId(value: unknown): number {
  if (typeof value === "bigint") {
    if (value < 1n || value > MAX_ID) return fail("Un identificador excede el contrato de enteros seguros positivos.");
    return Number(value);
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    return fail("Un identificador no cumple el contrato de enteros seguros positivos.");
  }
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") return fail("La fuente contiene un valor incompatible con su esquema declarado.");
  return value;
}

function legacyId(value: unknown, kind: IdKind): string {
  if (kind === "INTEGER") return String(positiveId(value));
  if (typeof value !== "string" || !value.trim()) return fail("La fuente contiene una clave antigua nula o vacía.");
  return value;
}

function rows(database: DatabaseSync, sql: string): Row[] {
  const statement = database.prepare(sql);
  statement.setReadBigInts(true);
  return statement.all();
}

function checkIntegrity(database: DatabaseSync): void {
  const checks = rows(database, "PRAGMA integrity_check");
  if (checks.length !== 1 || checks[0].integrity_check !== "ok") return fail("SQLite detectó problemas de integridad en la base.");
  if (rows(database, "PRAGMA foreign_key_check").length) return fail("La base contiene relaciones huérfanas; requiere revisión manual.");
}

// Solo se admiten las tablas administradas por estas historias. Una extensión ajena
// necesita su propia migración para evitar perder índices, triggers o restricciones.
function canonical(sql: string): string {
  // Los literales conservan sus bytes: 'BAS ICO' no equivale a 'BASICO'.
  return sql.replace(/'(?:''|[^'])*'|[^']+/g, (part) => part.startsWith("'") ? part : part.replace(/\s+/g, "").toUpperCase()
    .replace("CREATETABLEIFNOTEXISTS", "CREATETABLE")
    .replace(/CONSTRAINTFAVORITE_(ID|USER_ID)_SAFE(?=CHECK)/g, "")
    .replace(/CHECK\((ID|USER_ID)BETWEEN1AND9007199254740991\)/g, "")
    .replace(/CHECK\((ID|USER_ID)>0AND\1<=9007199254740991\)/g, "")
    .replace(/CHECK\((ID|USER_ID)>=1AND\1<=9007199254740991\)/g, ""));
}

function inspect(database: DatabaseSync): { users: IdKind; favorites: IdKind | null; recovery: boolean } {
  checkIntegrity(database);
  const objects = rows(database, "SELECT type, name, sql FROM sqlite_schema WHERE lower(substr(name, 1, 7)) <> 'sqlite_'");
  if (objects.some((item) => item.type !== "table" || !["users", "favorite_simulations", "password_recovery_tokens"].includes(String(item.name)))) {
    return fail("Esquema extendido o ya migrado: hay tablas, índices, vistas o triggers que requieren una migración coordinada.");
  }
  const userTable = objects.find((item) => item.name === "users");
  if (!userTable) return fail("Falta la tabla de usuarios; no se crearán cuentas artificiales para migrar favoritos.");
  function kind(table: string): IdKind {
    const columns = rows(database, `PRAGMA table_xinfo(${table})`);
    const primary = columns.filter((column) => column.pk !== 0n);
    const id = columns.find((column) => column.name === "id");
    if (columns.some((column) => column.hidden !== 0n) || primary.length !== 1 || id?.pk !== 1n || !["TEXT", "INTEGER"].includes(String(id.type).toUpperCase())) {
      return fail("La clave primaria o las columnas generadas requieren una migración específica.");
    }
    return String(id.type).toUpperCase() as IdKind;
  }
  const userKind = kind("users");
  const expectedUser = `CREATETABLEUSERS(ID${userKind}PRIMARYKEY,USERNAMETEXTNOTNULL,EMAILTEXTNOTNULLCOLLATENOCASEUNIQUE,PASSWORD_HASHTEXTNOTNULL,PLANTEXTNOTNULLDEFAULT'BASICO',CREATED_ATTEXTNOTNULL)`;
  if (canonical(text(userTable.sql)) !== expectedUser) return fail("El esquema de usuarios contiene diferencias no admitidas; se conserva sin cambios.");
  const favoriteTable = objects.find((item) => item.name === "favorite_simulations");
  const recoveryTable = objects.find((item) => item.name === "password_recovery_tokens");
  if (recoveryTable) {
    if (kind("password_recovery_tokens") !== "INTEGER") return fail("Los tokens requieren identificadores INTEGER.");
    const expectedRecovery = (owner: IdKind) => `CREATETABLEPASSWORD_RECOVERY_TOKENS(IDINTEGERPRIMARYKEYAUTOINCREMENT,USER_ID${owner}NOTNULLREFERENCESUSERS(ID),TOKEN_HASHTEXTNOTNULLUNIQUE,EXPIRES_ATTEXTNOTNULL,USEDINTEGERNOTNULLDEFAULT0,CREATED_ATTEXTNOTNULL)`;
    const recoverySql = canonical(text(recoveryTable.sql));
    if (recoverySql !== expectedRecovery("TEXT") && recoverySql !== expectedRecovery("INTEGER")) {
      return fail("El esquema de recuperación contiene diferencias no admitidas; se conserva sin cambios.");
    }
  }
  if (!favoriteTable) return { users: userKind, favorites: null, recovery: !!recoveryTable };
  const favoriteKind = kind("favorite_simulations");
  const sql = canonical(text(favoriteTable.sql));
  const expectedFavorite = (ownerKind: IdKind) => `CREATETABLEFAVORITE_SIMULATIONS(ID${favoriteKind}PRIMARYKEY,USER_ID${ownerKind}NOTNULLREFERENCESUSERS(ID)ONDELETECASCADE,FINGERPRINTTEXTNOTNULL,INSTRUMENTTEXTNOTNULLCHECK(INSTRUMENTIN('AHORROS','PLAZO_FIJO')),PARAMETERS_JSONTEXTNOTNULL,SNAPSHOT_JSONTEXTNOTNULL,CREATED_ATTEXTNOTNULL,UNIQUE(USER_ID,FINGERPRINT))`;
  if (sql !== expectedFavorite("TEXT") && sql !== expectedFavorite("INTEGER")) return fail("El esquema de favoritos contiene diferencias no admitidas; se conserva sin cambios.");
  return { users: userKind, favorites: favoriteKind, recovery: !!recoveryTable };
}

function destinationPath(file: string): string {
  const absolute = resolve(file);
  const parent = realpathSync(dirname(absolute));
  if (!statSync(parent).isDirectory()) return fail("El directorio de destino debe existir.");
  return resolve(parent, basename(absolute));
}

function paths(options: NumericMigrationOptions) {
  if (options.applyCopy !== true) return fail("La creación de una copia migrada requiere applyCopy explícito.");
  const source = realpathSync(resolve(options.source));
  if (!statSync(source).isFile()) return fail("La fuente debe ser un archivo SQLite existente.");
  const output = destinationPath(options.output);
  const backupPath = destinationPath(options.backup);
  const key = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
  if (new Set([source, output, backupPath].map(key)).size !== 3) return fail("Fuente, respaldo y salida deben ser rutas diferentes.");
  if (existsSync(output) || existsSync(backupPath)) return fail("La salida y el respaldo deben ser archivos nuevos. No se sobrescriben destinos.");
  return { source, output, backup: backupPath };
}

function reserve(file: string): void {
  // wx evita sobrescribir incluso si aparece un archivo después de la comprobación.
  const descriptor = openSync(file, "wx", 0o600);
  closeSync(descriptor);
}

function createSchema(database: DatabaseSync, favorites: boolean, recovery: boolean): void {
  database.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY CHECK(id BETWEEN 1 AND 9007199254740991),
      username TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'BASICO',
      created_at TEXT NOT NULL
    );
    CREATE TABLE identifier_migration_map (
      entity TEXT NOT NULL CHECK(entity IN ('users', 'favorite_simulations', 'password_recovery_tokens')),
      legacy_id TEXT NOT NULL,
      numeric_id INTEGER NOT NULL CHECK(numeric_id BETWEEN 1 AND 9007199254740991),
      PRIMARY KEY(entity, legacy_id),
      UNIQUE(entity, numeric_id)
    );
  `);
  if (recovery) database.exec(`
    CREATE TABLE password_recovery_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT CHECK(id BETWEEN 1 AND 9007199254740991),
      user_id INTEGER NOT NULL REFERENCES users(id) CHECK(user_id BETWEEN 1 AND 9007199254740991),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  if (favorites) database.exec(`
    CREATE TABLE favorite_simulations (
      id INTEGER PRIMARY KEY CONSTRAINT favorite_id_safe CHECK(id BETWEEN 1 AND 9007199254740991),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE CONSTRAINT favorite_user_id_safe CHECK(user_id BETWEEN 1 AND 9007199254740991),
      fingerprint TEXT NOT NULL,
      instrument TEXT NOT NULL CHECK(instrument IN ('AHORROS', 'PLAZO_FIJO')),
      parameters_json TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, fingerprint)
    );
  `);
}

/** Genera respaldo y salida nuevos. Nunca migra el archivo fuente en su lugar. */
export async function migrateNumericIdentifiers(options: NumericMigrationOptions): Promise<NumericMigrationResult> {
  const files = paths(options);
  const source = new DatabaseSync(files.source, { readOnly: true });
  try {
    inspect(source);
    reserve(files.backup);
    reserve(files.output);
    await backup(source, files.backup);
  } finally { source.close(); }

  const snapshot = new DatabaseSync(files.backup, { readOnly: true });
  let output: DatabaseSync | undefined;
  try {
    const schema = inspect(snapshot);
    output = new DatabaseSync(files.output);
    output.exec("PRAGMA foreign_keys = ON; BEGIN IMMEDIATE");
    try {
      createSchema(output, schema.favorites !== null, schema.recovery);
      const map = output.prepare("INSERT INTO identifier_migration_map(entity, legacy_id, numeric_id) VALUES (?, ?, ?)");
      const userMap = new Map<string, number>();
      const users = rows(snapshot, "SELECT id, username, email, password_hash, plan, created_at FROM users ORDER BY id COLLATE BINARY");
      for (const user of users) {
        const oldId = legacyId(user.id, schema.users);
        const values = [text(user.username), text(user.email), text(user.password_hash), text(user.plan), text(user.created_at)];
        const inserted = schema.users === "INTEGER"
          ? output.prepare("INSERT INTO users(id, username, email, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(positiveId(user.id), ...values)
          : output.prepare("INSERT INTO users(username, email, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?)").run(...values);
        const numeric = schema.users === "INTEGER" ? positiveId(user.id) : positiveId(inserted.lastInsertRowid);
        map.run("users", oldId, numeric);
        userMap.set(oldId, numeric);
      }
      const favorites = schema.favorites === null ? [] : rows(snapshot, `
        SELECT f.id, u.id AS owner_id, f.fingerprint, f.instrument, f.parameters_json, f.snapshot_json, f.created_at
        FROM favorite_simulations f JOIN users u ON u.id = f.user_id ORDER BY f.id COLLATE BINARY
      `);
      for (const favorite of favorites) {
        const owner = userMap.get(legacyId(favorite.owner_id, schema.users));
        if (!owner) return fail("No se pudo preservar el propietario de un favorito.");
        const oldId = legacyId(favorite.id, schema.favorites!);
        const values = [owner, text(favorite.fingerprint), text(favorite.instrument), text(favorite.parameters_json), text(favorite.snapshot_json), text(favorite.created_at)];
        const inserted = schema.favorites === "INTEGER"
          ? output.prepare("INSERT INTO favorite_simulations(id, user_id, fingerprint, instrument, parameters_json, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(positiveId(favorite.id), ...values)
          : output.prepare("INSERT INTO favorite_simulations(user_id, fingerprint, instrument, parameters_json, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(...values);
        map.run("favorite_simulations", oldId, schema.favorites === "INTEGER" ? positiveId(favorite.id) : positiveId(inserted.lastInsertRowid));
      }
      const sourceFavorites = schema.favorites === null ? 0n : rows(snapshot, "SELECT COUNT(*) AS n FROM favorite_simulations")[0].n;
      if (BigInt(favorites.length) !== sourceFavorites) return fail("El recuento de favoritos no coincide; la copia se revierte.");
      const tokens = !schema.recovery ? [] : rows(snapshot, `
        SELECT t.id, u.id AS owner_id, t.token_hash, t.expires_at, t.used, t.created_at
        FROM password_recovery_tokens t JOIN users u ON u.id = t.user_id ORDER BY t.id
      `);
      for (const token of tokens) {
        const owner = userMap.get(legacyId(token.owner_id, schema.users));
        if (!owner) return fail("No se pudo preservar el propietario de un token de recuperación.");
        const id = positiveId(token.id);
        if (typeof token.used !== "bigint") return fail("El estado del token de recuperación no es INTEGER.");
        output.prepare("INSERT INTO password_recovery_tokens(id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(id, owner, text(token.token_hash), text(token.expires_at), token.used, text(token.created_at));
        map.run("password_recovery_tokens", String(id), id);
      }
      if (schema.recovery) {
        const count = rows(snapshot, "SELECT COUNT(*) AS n FROM password_recovery_tokens")[0].n;
        if (BigInt(tokens.length) !== count) return fail("El recuento de tokens no coincide; la copia se revierte.");
        // Conserva AUTOINCREMENT incluso si se borró el último token antes de migrar.
        const sequence = rows(snapshot, "SELECT seq FROM sqlite_sequence WHERE name = 'password_recovery_tokens'")[0]?.seq;
        if (sequence !== undefined && sequence !== 0n) {
          const highWater = positiveId(sequence);
          output.prepare("DELETE FROM sqlite_sequence WHERE name = 'password_recovery_tokens'").run();
          output.prepare("INSERT INTO sqlite_sequence(name, seq) VALUES ('password_recovery_tokens', ?)").run(highWater);
        }
      }
      checkIntegrity(output);
      output.exec("COMMIT");
      checkIntegrity(output);
      return { ...files, users: users.length, favorites: favorites.length, recoveryTokens: tokens.length, sourceUnchanged: true };
    } catch (error) {
      if (output.isTransaction) output.exec("ROLLBACK");
      throw error;
    }
  } finally { output?.close(); snapshot.close(); }
}
