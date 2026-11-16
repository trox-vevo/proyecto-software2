import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const script = path.join(root, "scripts/update-fsd-catalog.mjs");
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "yupay-fsd-update-"));
  directories.push(directory);
  const file = path.join(directory, "db.sqlite");
  const backup = path.join(directory, "backup.sqlite");
  const db = new DatabaseSync(file);
  db.exec(readFileSync(path.join(root, "backend/db/schema.sql"), "utf8"));
  db.exec(readFileSync(path.join(root, "backend/db/seed.sql"), "utf8"));
  db.prepare("UPDATE financial_entities SET name = 'Entidad ' || char(64 + id), fsd_coverage = NULL").run();
  db.prepare("UPDATE financial_entities SET fsd_coverage = ? WHERE id = 3").run(JSON.stringify({ estado: "NO_CUBIERTO", entidadFinanciera: "Entidad C", fechaVerificacion: "2026-10-15", vigenteHasta: "2027-12-31", fuente: "https://www.fsd.org.pe/" }));
  db.exec("CREATE TABLE operaciones (id INTEGER PRIMARY KEY, entidad INTEGER REFERENCES financial_entities(id), monto TEXT); INSERT INTO operaciones VALUES (89, 3, '9007199254740993.25')");
  db.close();
  const run = (...args: string[]) => spawnSync(process.execPath, [script, "--database", file, ...args], { encoding: "utf8", timeout: 15000 });
  return { file, backup, run };
}

function read(file: string, sql: string) {
  const db = new DatabaseSync(file, { readOnly: true });
  try { return db.prepare(sql).all(); } finally { db.close(); }
}

describe("Actualización manual FSD: sin sobrescrituras ni migraciones de esquema", () => {
  it("la vista previa deja la base idéntica y no crea respaldos", () => {
    const { file, backup, run } = fixture();
    const before = readFileSync(file);
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("6 filas");
    expect(readFileSync(file)).toEqual(before);
    expect(existsSync(backup)).toBe(false);
  });

  it("aplica con respaldo consistente; solo cambia nombre/FSD y es idempotente", () => {
    const { file, backup, run } = fixture();
    const schema = read(file, "SELECT * FROM sqlite_master ORDER BY name");
    const products = read(file, "SELECT * FROM fixed_deposit_products ORDER BY id");
    const original = read(file, "SELECT * FROM financial_entities ORDER BY id");
    const result = run("--apply", "--backup", backup);
    expect(result.status, result.stderr).toBe(0);
    expect(read(backup, "SELECT * FROM financial_entities ORDER BY id")).toEqual(original);
    expect(read(file, "SELECT * FROM sqlite_master ORDER BY name")).toEqual(schema);
    expect(read(file, "SELECT * FROM fixed_deposit_products ORDER BY id")).toEqual(products);
    expect(read(file, "SELECT * FROM operaciones")).toEqual([{ id: 89, entidad: 3, monto: "9007199254740993.25" }]);
    expect(read(file, "SELECT id, name FROM financial_entities WHERE id = 3")).toEqual([{ id: 3, name: "Interbank" }]);
    expect(read(file, "PRAGMA foreign_key_check")).toEqual([]);
    expect(run("--apply", "--backup", backup).status).toBe(0);
  });

  it.each(["nombre", "evidencia", "colision", "trigger"])("rechaza %s personalizada sin cambiar la fuente", (kind) => {
    const { file, backup, run } = fixture();
    const db = new DatabaseSync(file);
    if (kind === "nombre") db.exec("UPDATE financial_entities SET name = 'Entidad de otro propietario' WHERE id = 1");
    if (kind === "evidencia") db.exec("UPDATE financial_entities SET fsd_coverage = '{}' WHERE id = 1");
    if (kind === "colision") db.exec("INSERT INTO financial_entities VALUES (70, 'BBVA Perú', 1, 1, 1, 1, NULL)");
    if (kind === "trigger") db.exec("CREATE TRIGGER cambia_saldo AFTER UPDATE ON financial_entities BEGIN UPDATE operaciones SET monto = '0'; END");
    db.close();
    const before = readFileSync(file);
    const result = run("--apply", "--backup", backup);
    expect(result.status).toBe(1);
    expect(readFileSync(file)).toEqual(before);
    expect(existsSync(backup)).toBe(false);
  });

  it("no sobrescribe un respaldo existente", () => {
    const { file, backup, run } = fixture();
    new DatabaseSync(backup).close();
    const before = readFileSync(file);
    const backupBefore = readFileSync(backup);
    expect(run("--apply", "--backup", backup).status).toBe(1);
    expect(readFileSync(file)).toEqual(before);
    expect(readFileSync(backup)).toEqual(backupBefore);
  });

  it("no crea bases nuevas ni rellena entidades ausentes en una base parcial", () => {
    const { file, backup, run } = fixture();
    const db = new DatabaseSync(file);
    db.exec("PRAGMA foreign_keys = OFF; DELETE FROM financial_entities WHERE id = 6");
    db.close();
    expect(run("--apply", "--backup", backup).status).toBe(0);
    expect(read(file, "SELECT id FROM financial_entities ORDER BY id")).toEqual([1, 2, 3, 4, 5].map((id) => ({ id })));
    const missing = path.join(path.dirname(file), "ausente.sqlite");
    expect(spawnSync(process.execPath, [script, "--database", missing]).status).toBe(1);
    expect(existsSync(missing)).toBe(false);
  });
});
