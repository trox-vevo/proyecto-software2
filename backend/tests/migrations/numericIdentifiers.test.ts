import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it, vi } from "vitest";
import { migrateNumericIdentifiers } from "../../src/migrations/NumericIdentifierMigration";
import { runNumericMigration } from "../../src/migrations/migrateNumericIdentifiers";

const directories: string[] = [];
function files() {
  const directory = mkdtempSync(join(tmpdir(), "yupay-numeric-migration-test-"));
  directories.push(directory);
  return { directory, source: join(directory, "legacy.sqlite"), output: join(directory, "numeric.sqlite"), backup: join(directory, "backup.sqlite"), applyCopy: true as const };
}
afterAll(() => {
  const parent = realpathSync(tmpdir()) + sep;
  for (const directory of directories) {
    if (!realpathSync(directory).startsWith(parent)) throw new Error("La limpieza debe permanecer dentro del directorio temporal.");
    rmSync(directory, { recursive: true, force: true });
  }
});

function fixture(file: string, userKind = "TEXT", favoriteKind?: string, ownerKind = userKind): DatabaseSync {
  const database = new DatabaseSync(file);
  database.exec(`CREATE TABLE users (
    id ${userKind} PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'BASICO',
    created_at TEXT NOT NULL
  )`);
  if (favoriteKind) database.exec(`CREATE TABLE favorite_simulations (
    id ${favoriteKind} PRIMARY KEY,
    user_id ${ownerKind} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fingerprint TEXT NOT NULL,
    instrument TEXT NOT NULL CHECK (instrument IN ('AHORROS', 'PLAZO_FIJO')),
    parameters_json TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, fingerprint)
  )`);
  return database;
}
function addUser(database: DatabaseSync, id: string | number | bigint | null, email = "test@example.com") {
  database.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run(id, "Persona sintética", email, "scrypt$salt$hash-preservado", "BASICO", "2026-11-06T00:00:00.000Z");
}
function addFavorite(database: DatabaseSync, id: string | number | bigint, owner: string | number | bigint, fingerprint = "huella") {
  database.prepare("INSERT INTO favorite_simulations VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, owner, fingerprint, "AHORROS", '{"instrument":"AHORROS","accountId":"AH-001","days":365}', '{"cuentaId":"AH-001","saldoFinal":"1,050.00"}', "2026-11-06T00:00:00.000Z");
}
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

describe("Migración explícita de identificadores sobre copias nuevas", () => {
  it("preserva hashes, correo, JSON, relaciones y unicidad sin escribir la fuente", async () => {
    const paths = files();
    const legacy = fixture(paths.source, "TEXT", "TEXT");
    addUser(legacy, "bbbbbbbb-0000-4000-8000-000000000001", "segundo@example.com");
    addUser(legacy, "aaaaaaaa-0000-4000-8000-000000000001", "PRIMERO@example.com");
    addFavorite(legacy, "fav-b", "bbbbbbbb-0000-4000-8000-000000000001");
    addFavorite(legacy, "fav-a", "aaaaaaaa-0000-4000-8000-000000000001");
    legacy.close();
    const before = hash(paths.source);
    expect(await migrateNumericIdentifiers(paths)).toMatchObject({ users: 2, favorites: 2, sourceUnchanged: true });
    expect(hash(paths.source)).toBe(before);
    const output = new DatabaseSync(paths.output);
    const backup = new DatabaseSync(paths.backup, { readOnly: true });
    try {
      expect(output.prepare("SELECT id, email, password_hash FROM users ORDER BY id").all()).toEqual([
        { id: 1, email: "PRIMERO@example.com", password_hash: "scrypt$salt$hash-preservado" },
        { id: 2, email: "segundo@example.com", password_hash: "scrypt$salt$hash-preservado" },
      ]);
      expect(output.prepare("SELECT id, user_id, parameters_json, snapshot_json FROM favorite_simulations ORDER BY id").all()).toEqual([
        { id: 1, user_id: 1, parameters_json: '{"instrument":"AHORROS","accountId":"AH-001","days":365}', snapshot_json: '{"cuentaId":"AH-001","saldoFinal":"1,050.00"}' },
        { id: 2, user_id: 2, parameters_json: '{"instrument":"AHORROS","accountId":"AH-001","days":365}', snapshot_json: '{"cuentaId":"AH-001","saldoFinal":"1,050.00"}' },
      ]);
      expect(output.prepare("SELECT entity, legacy_id, numeric_id FROM identifier_migration_map WHERE legacy_id = 'fav-b'").get()).toEqual({ entity: "favorite_simulations", legacy_id: "fav-b", numeric_id: 2 });
      expect(output.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(output.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
      expect(() => addUser(output, 3, "primero@example.com")).toThrow();
      expect(() => addFavorite(output, 3, 1)).toThrow();
      expect(backup.prepare("SELECT typeof(id) AS kind FROM users LIMIT 1").get()).toEqual({ kind: "text" });
      output.exec("PRAGMA foreign_keys = ON");
      expect(() => addFavorite(output, 3, 999, "otra")).toThrow();
    } finally { output.close(); backup.close(); }
  });

  it("produce la misma correspondencia en reintentos con destinos nuevos", async () => {
    const paths = files();
    const legacy = fixture(paths.source);
    addUser(legacy, "9-uuid-sin-conversion", "b@example.com");
    addUser(legacy, "1-uuid-sin-conversion", "a@example.com");
    legacy.close();
    await migrateNumericIdentifiers(paths);
    const next = { ...paths, output: join(paths.directory, "next.sqlite"), backup: join(paths.directory, "next-backup.sqlite") };
    await migrateNumericIdentifiers(next);
    const one = new DatabaseSync(paths.output, { readOnly: true });
    const two = new DatabaseSync(next.output, { readOnly: true });
    try {
      expect(one.prepare("SELECT * FROM identifier_migration_map ORDER BY legacy_id").all()).toEqual(two.prepare("SELECT * FROM identifier_migration_map ORDER BY legacy_id").all());
    } finally { one.close(); two.close(); }
  });

  it("preserva identificadores numéricos dispersos y MAX_SAFE_INTEGER exactamente", async () => {
    const paths = files();
    const source = fixture(paths.source, "INTEGER", "INTEGER");
    addUser(source, 42);
    addUser(source, BigInt(Number.MAX_SAFE_INTEGER), "limite@example.com");
    addFavorite(source, BigInt(Number.MAX_SAFE_INTEGER), 42);
    source.close();
    await migrateNumericIdentifiers(paths);
    const output = new DatabaseSync(paths.output, { readOnly: true });
    try {
      expect(output.prepare("SELECT id FROM users ORDER BY id").all()).toEqual([{ id: 42 }, { id: Number.MAX_SAFE_INTEGER }]);
      expect(output.prepare("SELECT id, user_id FROM favorite_simulations").get()).toEqual({ id: Number.MAX_SAFE_INTEGER, user_id: 42 });
    } finally { output.close(); }
  });

  it("resuelve relaciones SQLite de usuarios numéricos y favoritos antiguos sin convertir UUID", async () => {
    const paths = files();
    const source = fixture(paths.source, "INTEGER", "TEXT", "TEXT");
    addUser(source, 42);
    addFavorite(source, "favorito-uuid", "42");
    source.close();
    await migrateNumericIdentifiers(paths);
    const output = new DatabaseSync(paths.output, { readOnly: true });
    try { expect(output.prepare("SELECT id, user_id FROM favorite_simulations").get()).toEqual({ id: 1, user_id: 42 }); }
    finally { output.close(); }
  });

  it.each([0n, -1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n])("rechaza el ID fuera de contrato %s y revierte la salida", async (id) => {
    const paths = files();
    const source = fixture(paths.source, "INTEGER");
    addUser(source, id);
    source.close();
    const before = hash(paths.source);
    await expect(migrateNumericIdentifiers(paths)).rejects.toThrow(/identificador/i);
    expect(hash(paths.source)).toBe(before);
    const output = new DatabaseSync(paths.output, { readOnly: true });
    try { expect(output.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all()).toEqual([]); }
    finally { output.close(); }
    expect(existsSync(paths.backup)).toBe(true);
  });

  it.each([null, "", "   "])("rechaza claves antiguas nulas o vacías %j sin alterar el origen", async (id) => {
    const paths = files();
    const source = fixture(paths.source);
    addUser(source, id);
    source.close();
    const before = hash(paths.source);
    await expect(migrateNumericIdentifiers(paths)).rejects.toThrow(/clave antigua/);
    expect(hash(paths.source)).toBe(before);
  });

  it("rechaza favoritos huérfanos antes de crear destinos", async () => {
    const paths = files();
    const source = fixture(paths.source, "TEXT", "TEXT");
    source.exec("PRAGMA foreign_keys = OFF");
    addUser(source, "user-a");
    addFavorite(source, "fav-a", "ausente");
    source.close();
    await expect(migrateNumericIdentifiers(paths)).rejects.toThrow(/huérfanas/);
    expect(existsSync(paths.output)).toBe(false);
    expect(existsSync(paths.backup)).toBe(false);
  });

  it.each([
    "CREATE TABLE other(id INTEGER PRIMARY KEY, user_id TEXT REFERENCES users(id))",
    "CREATE TABLE sqliteXextra(id INTEGER PRIMARY KEY)",
    "CREATE INDEX custom_email ON users(email)",
    "CREATE VIEW user_view AS SELECT id FROM users",
    "CREATE TRIGGER user_trigger AFTER INSERT ON users BEGIN SELECT 1; END",
    "ALTER TABLE users ADD COLUMN extra TEXT GENERATED ALWAYS AS (email) VIRTUAL",
    "ALTER TABLE users ADD COLUMN extra TEXT CHECK(length(extra) > 2)",
  ])("rechaza extensiones ajenas que no puede preservar: %s", async (sql) => {
    const paths = files();
    const source = fixture(paths.source);
    source.exec(sql);
    source.close();
    const before = hash(paths.source);
    await expect(migrateNumericIdentifiers(paths)).rejects.toThrow();
    expect(hash(paths.source)).toBe(before);
    expect(existsSync(paths.output)).toBe(false);
  });

  it("rechaza AUTOINCREMENT sin descartar su secuencia", async () => {
    const paths = files();
    const source = fixture(paths.source, "INTEGER");
    source.exec("ALTER TABLE users RENAME TO previous_users");
    source.exec("CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'BASICO', created_at TEXT NOT NULL)");
    source.exec("DROP TABLE previous_users");
    source.close();
    await expect(migrateNumericIdentifiers(paths)).rejects.toThrow(/esquema de usuarios/);
  });

  it.each(["BAS ICO", "BASICOCHECK(IDBETWEEN1AND9007199254740991)"])("conserva el literal %s al comparar el esquema admitido", async (plan) => {
    const paths = files();
    const source = new DatabaseSync(paths.source);
    source.exec(`CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL, plan TEXT NOT NULL DEFAULT '${plan}', created_at TEXT NOT NULL)`);
    source.close();
    await expect(migrateNumericIdentifiers(paths)).rejects.toThrow(/esquema de usuarios/);
    expect(existsSync(paths.output)).toBe(false);
  });

  it.each(["output", "backup"] as const)("no sobrescribe el destino %s existente", async (field) => {
    const paths = files();
    const source = fixture(paths.source);
    source.close();
    writeFileSync(paths[field], "ARCHIVO PREEXISTENTE");
    await expect(migrateNumericIdentifiers(paths)).rejects.toThrow(/archivos nuevos/);
    expect(readFileSync(paths[field], "utf8")).toBe("ARCHIVO PREEXISTENTE");
  });

  it("rechaza alias de la fuente y falta de consentimiento explícito", async () => {
    const paths = files();
    const source = fixture(paths.source);
    source.close();
    await expect(migrateNumericIdentifiers({ ...paths, output: paths.source })).rejects.toThrow(/rutas diferentes/);
    await expect(migrateNumericIdentifiers({ ...paths, backup: paths.output })).rejects.toThrow(/rutas diferentes/);
    await expect(migrateNumericIdentifiers({ ...paths, applyCopy: false as unknown as true })).rejects.toThrow(/explícito/);
  });

  it("incluye escrituras confirmadas que continúan en WAL", async () => {
    const paths = files();
    const source = fixture(paths.source);
    source.exec("PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0");
    addUser(source, "wal-user");
    try {
      expect(existsSync(paths.source + "-wal")).toBe(true);
      await migrateNumericIdentifiers(paths);
      const output = new DatabaseSync(paths.output, { readOnly: true });
      try { expect(output.prepare("SELECT COUNT(*) AS n FROM users").get()).toEqual({ n: 1 }); }
      finally { output.close(); }
    } finally { source.close(); }
  });

  it("el CLI exige rutas completas y no imprime hashes, correos ni claves antiguas", async () => {
    await expect(runNumericMigration([])).rejects.toThrow(/Uso:/);
    await expect(runNumericMigration(["--source", "--output"])).rejects.toThrow(/ruta/);
    await expect(runNumericMigration(["--unknown"])).rejects.toThrow(/inválidos/);
    await expect(runNumericMigration(["--apply-copy", "--apply-copy"])).rejects.toThrow(/repetidos/);
    const paths = files();
    const source = fixture(paths.source);
    addUser(source, "legacy-no-publicar");
    source.close();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await runNumericMigration(["--source", paths.source, "--output", paths.output, "--backup", paths.backup, "--apply-copy"]);
      const printed = String(log.mock.calls[0][0]);
      expect(JSON.parse(printed)).toMatchObject({ status: "COPY_MIGRATED", users: 1, sourceUnchanged: true });
      expect(printed).not.toMatch(/test@example|hash-preservado|legacy-no-publicar/);
    } finally { log.mockRestore(); }
  });
});
