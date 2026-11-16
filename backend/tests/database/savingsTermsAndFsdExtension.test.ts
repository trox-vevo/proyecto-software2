import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { RepositorioCuentas } from "../../src/repositorio/RepositorioCuentas";
import { RepositorioCuentasSqlite } from "../../src/repositorio/RepositorioCuentasSqlite";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));
const tempFile = () => {
  const directory = mkdtempSync(path.join(tmpdir(), "yupay-terms-"));
  directories.push(directory);
  return path.join(directory, "yupay.sqlite");
};
const vigencia = (db: DatabaseSync, id: number) =>
  JSON.parse(String(db.prepare("SELECT fsd_coverage FROM financial_entities WHERE id = ?").get(id)!.fsd_coverage)).vigenteHasta;

describe("US08/US13: condiciones de búsqueda de las cuentas de ahorro", () => {
  it("la base y el JSON entregan el mismo departamento y monto mínimo", () => {
    const db = openDatabase(":memory:");
    try {
      const sqlite = new RepositorioCuentasSqlite(db).obtenerTodas().map((c) => [c.id, c.departamento, c.montoMinimo.toFixed(2)]);
      const json = new RepositorioCuentas().obtenerTodas().map((c) => [c.id, c.departamento, c.montoMinimo.toFixed(2)]);
      expect(sqlite).toEqual(json);
      expect(sqlite.every(([, departamento]) => typeof departamento === "string")).toBe(true);
    } finally { db.close(); }
  });

  it("una cuenta sin condiciones registradas no exige mínimo ni tiene departamento", () => {
    const db = openDatabase(":memory:");
    try {
      db.exec("DELETE FROM savings_account_terms WHERE account_id = 'AH-001'");
      const cuenta = new RepositorioCuentasSqlite(db).obtenerTodas().find((c) => c.id === "AH-001")!;
      expect(cuenta.departamento).toBeNull();
      expect(cuenta.montoMinimo.toFixed(2)).toBe("0.00");
    } finally { db.close(); }
  });
});

describe("Revisión local FSD extendida hasta 2026-12-15", () => {
  it("una base existente con la revisión anterior (22/11) se extiende al abrirla, sin tocar otras evidencias", () => {
    const file = tempFile();
    const old = openDatabase(file);
    old.exec(`UPDATE financial_entities SET fsd_coverage = json_set(fsd_coverage, '$.vigenteHasta', '2026-11-22') WHERE id IN (1, 2, 3)`);
    // Evidencia personalizada: otra fecha de consulta. No debe cambiar.
    old.exec(`UPDATE financial_entities SET fsd_coverage = json_set(fsd_coverage, '$.vigenteHasta', '2026-11-22', '$.fechaVerificacion', '2026-11-10') WHERE id = 4`);
    const antes5 = old.prepare("SELECT fsd_coverage FROM financial_entities WHERE id = 5").get()!.fsd_coverage;
    old.close();

    const db = openDatabase(file);
    try {
      expect([1, 2, 3].map((id) => vigencia(db, id))).toEqual(["2026-12-15", "2026-12-15", "2026-12-15"]);
      expect(vigencia(db, 4)).toBe("2026-11-22");
      expect(db.prepare("SELECT fsd_coverage FROM financial_entities WHERE id = 5").get()!.fsd_coverage).toBe(antes5);
    } finally { db.close(); }
  });

  it("reabrir la base es idempotente", () => {
    const file = tempFile();
    openDatabase(file).close();
    const first = new DatabaseSync(file, { readOnly: true });
    const before = first.prepare("SELECT * FROM financial_entities ORDER BY id").all();
    first.close();
    const db = openDatabase(file);
    try {
      expect(db.prepare("SELECT * FROM financial_entities ORDER BY id").all()).toEqual(before);
    } finally { db.close(); }
  });
});
