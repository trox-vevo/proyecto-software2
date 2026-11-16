import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { assertSavingsEntityMigration } from "../../src/migrations/SavingsEntitySchema";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";

const root = path.resolve(__dirname, "../../..");
const script = path.join(root, "scripts/link-savings-entities.mjs");
const ddl = readFileSync(path.join(root, "backend/db/savings-entity-links.sql"), "utf8");
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "yupay-savings-migration-"));
  directories.push(directory);
  const file = path.join(directory, "original.sqlite");
  const backup = path.join(directory, "backup.sqlite");
  const db = openDatabase(file);
  db.exec("DROP TABLE savings_account_entities");
  db.exec("CREATE TABLE operaciones_prueba (id INTEGER PRIMARY KEY, account_id TEXT REFERENCES savings_accounts(id), monto TEXT); INSERT INTO operaciones_prueba VALUES (81, 'AH-001', '9007199254740993.25')");
  db.close();
  const run = (...args: string[]) => spawnSync(process.execPath, [script, "--database", file, ...args], { encoding: "utf8", timeout: 20000 });
  return { file, backup, run, directory };
}

function snapshot(file: string) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const schema = db.prepare("SELECT * FROM sqlite_master WHERE tbl_name != 'savings_account_entities' ORDER BY name").all();
    const rows = Object.fromEntries(schema.filter((item) => item.type === "table").map((item) => [String(item.name), db.prepare(`SELECT * FROM "${String(item.name).replaceAll('"', '""')}"`).all()]));
    return { schema, rows };
  } finally { db.close(); }
}

describe("US21: migración aditiva con respaldo y preservación", () => {
  it("inspección y vista previa no cambian bytes ni crean bases o respaldos", () => {
    const { file, backup, run, directory } = fixture();
    const before = readFileSync(file);
    expect(() => assertSavingsEntityMigration(file)).toThrow(/migración explícita/);
    expect(() => openDatabase(file)).toThrow(/migración explícita/);
    expect(run().status).toBe(0);
    expect(readFileSync(file)).toEqual(before);
    expect(existsSync(backup)).toBe(false);
    const missing = path.join(directory, "ausente.sqlite");
    expect(() => assertSavingsEntityMigration(missing)).not.toThrow();
    expect(spawnSync(process.execPath, [script, "--database", missing]).status).toBe(1);
    expect(existsSync(missing)).toBe(false);
  });

  it("respalda antes de crear las seis asociaciones y conserva íntegramente tablas y relaciones previas", () => {
    const { file, backup, run } = fixture();
    const before = snapshot(file);
    const applied = run("--apply", "--backup", backup);
    expect(applied.status, applied.stderr).toBe(0);
    expect(snapshot(backup)).toEqual(before);
    expect(snapshot(file)).toEqual(before);
    expect(() => assertSavingsEntityMigration(file)).not.toThrow();
    const db = openDatabase(file);
    try {
      expect(db.prepare("SELECT * FROM savings_account_entities ORDER BY account_id").all()).toEqual([1, 2, 3, 4, 5, 6].map((id) => ({ account_id: `AH-00${id}`, entity_id: id })));
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(() => db.exec("INSERT INTO savings_account_entities VALUES ('AH-999', 1)")).toThrow();
      expect(() => db.exec("UPDATE savings_account_entities SET entity_id = 999 WHERE account_id = 'AH-001'")).toThrow();
      expect(() => db.exec("DELETE FROM financial_entities WHERE id = 1")).toThrow();
    } finally { db.close(); }
  });

  it("es idempotente y no sobrescribe el respaldo en un segundo intento", () => {
    const { file, backup, run } = fixture();
    expect(run("--apply", "--backup", backup).status).toBe(0);
    const before = readFileSync(file);
    const copy = readFileSync(backup);
    expect(run("--apply", "--backup", backup).status).toBe(0);
    expect(readFileSync(file)).toEqual(before);
    expect(readFileSync(backup)).toEqual(copy);
  });

  it("exige respaldo nuevo sin modificar el origen si falta o ya existe", () => {
    const { file, backup, run } = fixture();
    const before = readFileSync(file);
    expect(run("--apply").status).toBe(1);
    new DatabaseSync(backup).close();
    const copy = readFileSync(backup);
    expect(run("--apply", "--backup", backup).status).toBe(1);
    expect(readFileSync(file)).toEqual(before);
    expect(readFileSync(backup)).toEqual(copy);
  });

  it.each(["nombre", "relacion", "esquema", "trigger", "integridad"])("detiene %s incompatible antes de escribir", (kind) => {
    const { file, backup, run } = fixture();
    const db = new DatabaseSync(file);
    if (kind === "nombre") db.exec("UPDATE financial_entities SET name = 'Entidad personalizada' WHERE id = 1");
    if (kind === "esquema") db.exec("CREATE TABLE savings_account_entities (account_id INTEGER, entity_id TEXT)");
    if (kind === "relacion") { db.exec(ddl); db.exec("INSERT INTO savings_account_entities VALUES ('AH-001', 2)"); }
    if (kind === "trigger") { db.exec(ddl); db.exec("CREATE TRIGGER altera_datos AFTER INSERT ON savings_account_entities BEGIN UPDATE savings_accounts SET balance = '0'; END"); }
    if (kind === "integridad") db.exec("PRAGMA foreign_keys = OFF; INSERT INTO operaciones_prueba VALUES (82, 'NO-EXISTE', '10')");
    db.close();
    const before = readFileSync(file);
    expect(run("--apply", "--backup", backup).status).toBe(1);
    expect(readFileSync(file)).toEqual(before);
    expect(existsSync(backup)).toBe(false);
  });

  it("no fabrica cuentas ausentes ni asigna cuentas personalizadas por coincidencia de nombre", () => {
    const { file, backup, run } = fixture();
    const db = new DatabaseSync(file);
    db.exec("DELETE FROM savings_accounts WHERE id = 'AH-006'");
    db.exec("INSERT INTO savings_accounts SELECT 'CUSTOM', holder, balance, annual_rate, opened_at, monthly_maintenance_fee, has_physical_branches, has_atms, has_digital_banking, has_mobile_app, fsd_coverage FROM savings_accounts WHERE id = 'AH-001'");
    db.close();
    const before = snapshot(file);
    expect(run("--apply", "--backup", backup).status).toBe(0);
    expect(snapshot(file)).toEqual(before);
    const check = new DatabaseSync(file, { readOnly: true });
    try {
      expect(check.prepare("SELECT COUNT(*) AS n FROM savings_account_entities").get()!.n).toBe(5);
      expect(check.prepare("SELECT * FROM savings_account_entities WHERE account_id = 'CUSTOM'").get()).toBeUndefined();
    } finally { check.close(); }
  });

  it("el respaldo incluye operaciones pendientes de checkpoint en WAL", () => {
    const { file, backup, run } = fixture();
    const writer = new DatabaseSync(file);
    try {
      writer.exec("PRAGMA journal_mode = WAL; INSERT INTO operaciones_prueba VALUES (92, 'AH-002', '777.25')");
      const before = snapshot(file);
      const applied = run("--apply", "--backup", backup);
      expect(applied.status, applied.stderr).toBe(0);
      expect(snapshot(backup)).toEqual(before);
      expect(snapshot(file)).toEqual(before);
    } finally { writer.close(); }
  });

  it("revierte todas las inserciones si una restricción impide terminar", () => {
    const { file, backup, run } = fixture();
    const db = new DatabaseSync(file);
    db.exec("CREATE TABLE savings_account_entities (account_id TEXT NOT NULL PRIMARY KEY REFERENCES savings_accounts(id), entity_id INTEGER NOT NULL REFERENCES financial_entities(id) CHECK(entity_id < 4))");
    db.close();
    const original = snapshot(file);
    expect(run("--apply", "--backup", backup).status).toBe(1);
    expect(snapshot(file)).toEqual(original);
    expect(snapshot(backup)).toEqual(original);
    const check = new DatabaseSync(file, { readOnly: true });
    try { expect(check.prepare("SELECT COUNT(*) AS n FROM savings_account_entities").get()!.n).toBe(0); }
    finally { check.close(); }
  });
});
