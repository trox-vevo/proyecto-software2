import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ServicioAlertas } from "../../src/alertas/application/ServicioAlertas";
import { SqliteAlertasRepository } from "../../src/alertas/infrastructure/SqliteAlertasRepository";
import { validarCoberturaFSD } from "../../src/fsd/CoberturaFSD";
import { SqliteNotificationQueueRepository } from "../../src/notifications/queue/infrastructure/SqliteNotificationQueueRepository";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";

const dbDir = path.resolve(__dirname, "../../db");
const revision = JSON.parse(readFileSync(path.join(dbDir, "fsd-verificacion-2026-11-15.json"), "utf8"));
const baseline = JSON.parse(readFileSync(path.join(__dirname, "catalog-baseline.json"), "utf8"));
const today = new Date("2026-11-15T12:00:00Z");
const keys: Record<string, string> = { financial_entities: "id", fixed_deposit_products: "id", savings_accounts: "id", sbs_risk_profiles: "entity_id", economist_reports: "entity_id" };
// Campos agregados después de fijar la línea base: se excluyen de la huella y se comprueban aparte.
const excluidos: Record<string, string[]> = {
  financial_entities: ["name", "fsd_coverage"],
  savings_accounts: ["entity_id", "department", "minimum_amount"],
};
const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe("US21/US35: catálogo FSD local con identidades reales", () => {
  it("conserva todos los valores originales salvo nombre y evidencia FSD de financial_entities", () => {
    const db = openDatabase(":memory:");
    try {
      for (const [table, key] of Object.entries(keys)) {
        const rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${key}`).all().map((row) =>
          Object.fromEntries(Object.entries(row).filter(([field]) => !(excluidos[table] ?? []).includes(field))));
        // Hashes fijados con el seed original de f823cf1; no se regeneran desde los nuevos datos.
        expect(createHash("sha256").update(JSON.stringify(rows)).digest("hex"), table).toBe(baseline[table]);
      }
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { db.close(); }
  });

  it("US09/US11: asocia cada cuenta de ahorro a su entidad, departamento y monto mínimo", () => {
    const db = openDatabase(":memory:");
    try {
      expect(db.prepare("SELECT id, entity_id, department, minimum_amount FROM savings_accounts ORDER BY id").all()).toEqual([
        { id: "AH-001", entity_id: 1, department: "Lima", minimum_amount: "0.00" },
        { id: "AH-002", entity_id: 2, department: "Lima", minimum_amount: "0.00" },
        { id: "AH-003", entity_id: 3, department: "Lima", minimum_amount: "1000.00" },
        { id: "AH-004", entity_id: 4, department: "Lima", minimum_amount: "0.00" },
        { id: "AH-005", entity_id: 5, department: "Lima", minimum_amount: "500.00" },
        { id: "AH-006", entity_id: 6, department: "Cusco", minimum_amount: "0.00" },
      ]);
    } finally { db.close(); }
  });

  it("solo utiliza seis IDs existentes y documenta las doce entidades sin inventar nuevos productos", () => {
    const db = openDatabase(":memory:");
    try {
      expect(revision.entidades).toHaveLength(12);
      expect(revision.entidades.filter((entry: { verificadaFsd: boolean }) => entry.verificadaFsd)).toHaveLength(8);
      const rows = db.prepare("SELECT id, name, fsd_coverage FROM financial_entities ORDER BY id").all();
      expect(rows.map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 6]);
      for (const row of rows) {
        const entry = revision.entidades.find((item: { idExistente: number }) => item.idExistente === row.id);
        const raw = JSON.parse(String(row.fsd_coverage));
        expect(row.name).toBe(entry.nombre);
        expect(raw.entidadFinanciera).toBe(entry.nombre);
        expect(raw.fechaVerificacion).toBe(revision.consultadoEl);
        expect(validarCoberturaFSD(raw, today).estado).toBe(entry.verificadaFsd ? "CUBIERTO" : "NO_VERIFICADO");
        expect(raw.estado).not.toBe("NO_CUBIERTO");
      }
    } finally { db.close(); }
  });

  it("conserva los catálogos JSON alternativos excepto el nombre de la entidad", () => {
    for (const file of ["sbs.json", "informes.json"]) {
      const rows = JSON.parse(readFileSync(path.resolve(dbDir, "../data", file), "utf8")) as Record<string, unknown>[];
      const values = rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "entityName")));
      expect(createHash("sha256").update(JSON.stringify(values)).digest("hex"), file).toBe(baseline[file]);
    }
  });

  it("vence la revisión local sin debilitar la validación ni renovarla automáticamente", () => {
    const db = openDatabase(":memory:");
    try {
      const raw = JSON.parse(String(db.prepare("SELECT fsd_coverage FROM financial_entities WHERE id = 1").get()!.fsd_coverage));
      expect(validarCoberturaFSD(raw, today).estado).toBe("CUBIERTO");
      expect(validarCoberturaFSD(raw, new Date("2026-11-22T23:59:00Z")).estado).toBe("CUBIERTO");
      expect(validarCoberturaFSD(raw, new Date("2026-11-23T00:00:00Z")).estado).toBe("NO_VERIFICADO");
      expect(validarCoberturaFSD(raw, new Date("2026-11-14T00:00:00Z")).estado).toBe("NO_VERIFICADO");
      expect(validarCoberturaFSD({ ...raw, fuente: "https://fsd.org.pe.falso.test/" }, today).estado).toBe("NO_VERIFICADO");
    } finally { db.close(); }
  });

  it("mantiene sincronizada la copia SQL de documentación", () => {
    expect(readFileSync(path.resolve(dbDir, "../../docs/BaseDeDatos/seed.sql"), "utf8")).toBe(readFileSync(path.join(dbDir, "seed.sql"), "utf8"));
  });

  it("no sobrescribe una entidad o evidencia existente al reiniciar", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "yupay-seed-fsd-"));
    directories.push(directory);
    const file = path.join(directory, "db.sqlite");
    const first = openDatabase(file);
    first.prepare("UPDATE financial_entities SET name = ?, fsd_coverage = NULL WHERE id = 1").run("Nombre personalizado");
    first.close();
    const second = openDatabase(file);
    try { expect(second.prepare("SELECT name, fsd_coverage FROM financial_entities WHERE id = 1").get()).toEqual({ name: "Nombre personalizado", fsd_coverage: null }); }
    finally { second.close(); }
  });

  it("US35 obtiene nombre y FSD del catálogo para advertir cobertura no verificada sin cambiar eventos", () => {
    const db = openDatabase(":memory:");
    try {
      db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY); INSERT INTO users VALUES (7)");
      new SqliteNotificationQueueRepository(db);
      const repository = new SqliteAlertasRepository(db);
      for (const entityId of [1, 5]) {
        const event = { eventId: `fsd-${entityId}`, entityId, type: "CAMBIO_TASA", previousValue: "0.05", currentValue: "0.06", occurredAt: today.toISOString() };
        db.prepare(`INSERT INTO market_notification_queue (event_id, event_json, user_id, frequency, idempotency_key, status, available_at, created_at)
          VALUES (?, ?, 7, 'INMEDIATA', ?, 'SENT', ?, ?)`)
          .run(event.eventId, JSON.stringify(event), event.eventId, today.toISOString(), today.toISOString());
      }
      const eventsBefore = db.prepare("SELECT * FROM market_notification_queue ORDER BY id").all();
      const alerts = new ServicioAlertas(repository).listar(7);
      expect(alerts.find((alert) => alert.entidadId === 1)).toMatchObject({ entidad: "Banco de Crédito del Perú (BCP)", coberturaFSD: { estado: "CUBIERTO" } });
      expect(alerts.find((alert) => alert.entidadId === 5)).toMatchObject({ entidad: "Cooperativa Abaco", coberturaFSD: { estado: "NO_VERIFICADO" } });
      expect(db.prepare("SELECT * FROM market_notification_queue ORDER BY id").all()).toEqual(eventsBefore);
    } finally { db.close(); }
  });
});
