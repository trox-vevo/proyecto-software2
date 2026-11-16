import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";

// US09/US11: savings_accounts pasa a representar el producto de ahorro de una entidad.
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

const PRODUCTOS = [
  { id: "AH-001", entity_id: 1, department: "Lima", minimum_amount: "0.00" },
  { id: "AH-002", entity_id: 2, department: "Lima", minimum_amount: "0.00" },
  { id: "AH-003", entity_id: 3, department: "Lima", minimum_amount: "1000.00" },
  { id: "AH-004", entity_id: 4, department: "Lima", minimum_amount: "0.00" },
  { id: "AH-005", entity_id: 5, department: "Lima", minimum_amount: "500.00" },
  { id: "AH-006", entity_id: 6, department: "Cusco", minimum_amount: "0.00" },
];

const ORIGINALES = "SELECT id, holder, balance, annual_rate, opened_at, monthly_maintenance_fee, has_physical_branches, has_atms, has_digital_banking, has_mobile_app, fsd_coverage FROM savings_accounts ORDER BY id";

/** Base creada antes de la US09: savings_accounts sin las tres columnas de producto. */
function crearBaseAntigua(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "yupay-ahorros-"));
  directories.push(directory);
  const file = path.join(directory, "antigua.sqlite");
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE savings_accounts (
    id TEXT PRIMARY KEY, holder TEXT NOT NULL, balance TEXT NOT NULL, annual_rate TEXT NOT NULL, opened_at TEXT NOT NULL,
    monthly_maintenance_fee TEXT NOT NULL,
    has_physical_branches INTEGER NOT NULL CHECK (has_physical_branches IN (0, 1)),
    has_atms INTEGER NOT NULL CHECK (has_atms IN (0, 1)),
    has_digital_banking INTEGER NOT NULL CHECK (has_digital_banking IN (0, 1)),
    has_mobile_app INTEGER NOT NULL CHECK (has_mobile_app IN (0, 1)),
    fsd_coverage TEXT);
  INSERT INTO savings_accounts VALUES
    ('AH-001', 'Ana Torres', '1000.00', '0.05', '2023-01-10', '0.00', 1, 1, 1, 1, NULL),
    ('AH-002', 'Beto Quispe', '5000.00', '0.02', '2022-06-01', '0.00', 1, 0, 1, 0, NULL),
    ('AH-003', 'Carla Rojas', '300.00', '0.1', '2024-03-15', '5.00', 0, 1, 0, 1, NULL),
    ('AH-004', 'Diego Salas', '12500.50', '0.035', '2021-11-20', '0.00', 0, 0, 0, 0, NULL),
    ('AH-005', 'Elena Vargas', '850.75', '0.045', '2024-08-05', '8.50', 1, 1, 1, 1, NULL),
    ('AH-006', 'Fabio Medina', '2200.00', '0.03', '2023-09-30', '3.00', 1, 0, 0, 1, NULL);`);
  db.close();
  return file;
}

const productos = (db: DatabaseSync) =>
  db.prepare("SELECT id, entity_id, department, minimum_amount FROM savings_accounts ORDER BY id").all();

describe("US09: columnas de producto en savings_accounts", () => {
  it("una base nueva trae cada cuenta asociada a su entidad, departamento y monto mínimo", () => {
    const db = openDatabase(":memory:");
    try {
      expect(db.prepare("SELECT entity_id, department, minimum_amount FROM savings_accounts WHERE id = 'AH-003'").get())
        .toEqual({ entity_id: 3, department: "Lima", minimum_amount: "1000.00" });
      expect(productos(db)).toEqual(PRODUCTOS);
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { db.close(); }
  });

  it("migra una base antigua sin tocar los valores existentes y es idempotente", () => {
    const file = crearBaseAntigua();
    const antes = new DatabaseSync(file);
    const originales = antes.prepare(ORIGINALES).all();
    antes.close();

    const primera = openDatabase(file);
    try {
      const columnas = primera.prepare("PRAGMA table_info(savings_accounts)").all().map((columna) => columna.name);
      expect(columnas).toEqual(expect.arrayContaining(["entity_id", "department", "minimum_amount"]));
      expect(productos(primera)).toEqual(PRODUCTOS);
      expect(primera.prepare(ORIGINALES).all()).toEqual(originales);
      expect(primera.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { primera.close(); }

    const segunda = openDatabase(file);
    try {
      expect(segunda.prepare("SELECT COUNT(*) AS n FROM savings_accounts").get()).toEqual({ n: 6 });
      expect(productos(segunda)).toEqual(PRODUCTOS);
      expect(segunda.prepare(ORIGINALES).all()).toEqual(originales);
    } finally { segunda.close(); }
  });

  it("no sobrescribe un producto ya asignado al reiniciar", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "yupay-ahorros-"));
    directories.push(directory);
    const file = path.join(directory, "db.sqlite");
    const primera = openDatabase(file);
    primera.prepare("UPDATE savings_accounts SET department = 'Arequipa' WHERE id = 'AH-001'").run();
    primera.close();
    const segunda = openDatabase(file);
    try {
      expect(segunda.prepare("SELECT department FROM savings_accounts WHERE id = 'AH-001'").get()).toEqual({ department: "Arequipa" });
    } finally { segunda.close(); }
  });
});
