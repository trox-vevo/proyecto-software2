import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteUserRepository } from "../../../src/registration/infrastructure/SqliteUserRepository";
import { ProAccessService } from "../../../src/auth/application/ProAccessService";
import { NotificationPreferencesService } from "../../../src/notifications/NotificationPreferencesService";
import { SelectiveNotificationEnqueuer } from "../../../src/notifications/queue/application/SelectiveNotificationEnqueuer";
import { SqliteNotificationQueueRepository } from "../../../src/notifications/queue/infrastructure/SqliteNotificationQueueRepository";
import type { AlertEvent, EligibleRecipient, QueueInput } from "../../../src/notifications/queue/domain/QueueContracts";

const now = "2026-11-14T00:00:00.000Z";
const later = "2026-11-15T00:00:00.000Z";
const event: AlertEvent = { eventId: "cambio-1", entityId: 1, type: "CAMBIO_TASA",
  previousValue: "0.05", currentValue: "0.06", occurredAt: now };
let dir: string;
let file: string;
let users: SqliteUserRepository;
let db: DatabaseSync;
let queue: SqliteNotificationQueueRepository;
let enqueuer: SelectiveNotificationEnqueuer;
let pro: number;
let basic: number;
const recipient = (id: number): EligibleRecipient => ({ userId: id, eventId: event.eventId, frequency: "INMEDIATA" });
const input = (id: number): QueueInput => ({ event, userId: id, frequency: "INMEDIATA", availableAt: now });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "yupay-queue-")); file = join(dir, "queue.sqlite");
  users = new SqliteUserRepository(file);
  pro = users.create({ username: "Pro", email: "pro@example.test", passwordHash: "fixture", plan: "PRO", createdAt: now }).id;
  basic = users.create({ username: "Basic", email: "basic@example.test", passwordHash: "fixture", plan: "BASICO", createdAt: now }).id;
  db = new DatabaseSync(file);
  queue = new SqliteNotificationQueueRepository(db);
  enqueuer = new SelectiveNotificationEnqueuer(queue, new ProAccessService(users), new NotificationPreferencesService(users), () => new Date(now));
});
afterEach(() => {
  db.close(); users.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep + "yupay-queue-")) throw new Error("Ruta temporal inesperada");
  rmSync(dir, { recursive: true });
});

describe("TS-121 cola persistente", () => {
  it("encola solo seleccionados con acceso y preferencias actuales, sin destinatarios no inserta", () => {
    expect(enqueuer.enqueueEligible(event, [])).toBe(0);
    expect(enqueuer.enqueueEligible(event, [recipient(pro), recipient(basic)])).toBe(1);
    expect(queue.pending("INMEDIATA", 10, now)).toHaveLength(1);
  });
  it("encola varios Pro y evita duplicados dentro del lote y al reintentar", () => {
    const second = users.create({ username: "Pro2", email: "pro2@example.test", passwordHash: "fixture", plan: "PRO", createdAt: now }).id;
    expect(enqueuer.enqueueEligible(event, [recipient(pro), recipient(second), recipient(pro)])).toBe(2);
    expect(enqueuer.enqueueEligible(event, [recipient(pro), recipient(second)])).toBe(0);
    expect(queue.pending("INMEDIATA", 10, now).map((m) => m.userId)).toEqual([pro, second]);
  });
  it.each(["CAMBIO_TASA", "CAMBIO_RIESGO"] as const)("respeta el tipo %s", (type) => {
    const notification = { ...event, type };
    expect(enqueuer.enqueueEligible(notification, [recipient(pro)])).toBe(1);
    expect(queue.pending("INMEDIATA", 1, now)[0].event.type).toBe(type);
  });
  it("revalida exclusiones y frecuencia desde preferencias, no acepta plan del cliente", () => {
    users.saveNotificationPreferences(pro, { alertTypes: ["CAMBIO_RIESGO"], frequency: "INMEDIATA" });
    expect(enqueuer.enqueueEligible(event, [recipient(pro)])).toBe(0);
    expect(enqueuer.enqueueEligible(event, [{ ...recipient(basic), ...{ plan: "PRO" } }])).toBe(0);
    users.saveNotificationPreferences(pro, { alertTypes: ["CAMBIO_TASA"], frequency: "RESUMEN_DIARIO" });
    expect(enqueuer.enqueueEligible(event, [recipient(pro)])).toBe(0);
    expect(enqueuer.enqueueEligible(event, [{ ...recipient(pro), frequency: "RESUMEN_DIARIO", availableAt: later }])).toBe(1);
    expect(queue.pending("INMEDIATA", 10, later)).toHaveLength(0);
    expect(queue.pending("RESUMEN_DIARIO", 10, now)).toHaveLength(0);
    expect(queue.pending("RESUMEN_DIARIO", 10, later)).toHaveLength(1);
  });
  it("omite Pro vencido y usuarios inexistentes consultando el repositorio real", () => {
    db.prepare("UPDATE users SET plan_expires_at=? WHERE id=?").run("2000-01-01T00:00:00.000Z", pro);
    expect(enqueuer.enqueueEligible(event, [recipient(pro), recipient(999999)])).toBe(0);
  });
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN])("rechaza usuario inválido %s sin insertar parcialmente", (invalid) => {
    expect(() => enqueuer.enqueueEligible(event, [recipient(pro), recipient(invalid)])).toThrow();
    expect(queue.pending("INMEDIATA", 10, now)).toHaveLength(0);
  });
  it("rechaza eventos, selección y fechas inválidas", () => {
    expect(() => enqueuer.enqueueEligible({ ...event, eventId: "" }, [])).toThrow();
    expect(() => enqueuer.enqueueEligible({ ...event, currentValue: "NaN" }, [])).toThrow();
    expect(() => enqueuer.enqueueEligible({ ...event, occurredAt: "ayer" }, [])).toThrow();
    expect(() => enqueuer.enqueueEligible(event, [{ ...recipient(pro), eventId: "otro" }])).toThrow();
    expect(() => enqueuer.enqueueEligible(event, [{ ...recipient(pro), frequency: "RESUMEN_DIARIO" }])).toThrow();
    expect(() => enqueuer.enqueueEligible(event, [{ ...recipient(pro), frequency: "RESUMEN_DIARIO", availableAt: now }])).toThrow();
  });
  it("un fallo de FK revierte todo el lote", () => {
    expect(() => queue.enqueueBatch([input(pro), input(999999)], now)).toThrow();
    expect(queue.pending("INMEDIATA", 10, now)).toHaveLength(0);
  });
  it("rechaza reutilizar un evento con contenido distinto y revierte nuevas inserciones", () => {
    queue.enqueueBatch([input(pro)], now);
    expect(() => queue.enqueueBatch([{ ...input(pro), event: { ...event, eventId: "otro" } },
      { ...input(pro), event: { ...event, currentValue: "0.99" } }], now)).toThrow();
    expect(queue.pending("INMEDIATA", 10, now)).toHaveLength(1);
  });
  it("persiste al reabrir y conserva FIFO por disponibilidad e id", () => {
    queue.enqueueBatch([input(pro), { ...input(pro), event: { ...event, eventId: "segundo" } }], now);
    db.close(); db = new DatabaseSync(file); queue = new SqliteNotificationQueueRepository(db);
    expect(queue.pending("INMEDIATA", 10, now).map((m) => m.event.eventId)).toEqual(["cambio-1", "segundo"]);
  });
  it("dos conexiones no reservan un mensaje a la vez, verifica token al confirmar", () => {
    queue.enqueueBatch([input(pro)], now);
    const otherDb = new DatabaseSync(file);
    try {
      const other = new SqliteNotificationQueueRepository(otherDb);
      const [claimed] = queue.claimPending("INMEDIATA", 1, now, 1000);
      expect(other.claimPending("INMEDIATA", 1, now, 1000)).toHaveLength(0);
      expect(other.markDelivered(claimed.id, "token-ajeno", now)).toBe(false);
      expect(queue.markDelivered(claimed.id, claimed.claimToken!, now)).toBe(true);
      expect(queue.findById(claimed.id)?.status).toBe("SENT");
      expect(queue.markDelivered(claimed.id, claimed.claimToken!, now)).toBe(false);
    } finally { otherDb.close(); }
  });
  it("recupera reserva vencida, invalida token anterior y registra fallo sin reintento automático", () => {
    queue.enqueueBatch([input(pro)], now);
    const [old] = queue.claimPending("INMEDIATA", 1, now, 1000);
    const after = "2026-11-14T00:00:01.000Z";
    const [claimed] = queue.claimPending("INMEDIATA", 1, after, 1000);
    expect(queue.markDelivered(old.id, old.claimToken!, after)).toBe(false);
    expect(queue.markFailed(claimed.id, claimed.claimToken!, "fallo sintético de transporte", after)).toBe(true);
    expect(queue.findById(claimed.id)).toMatchObject({ status: "FAILED", lastError: "fallo sintético de transporte" });
    expect(queue.pending("INMEDIATA", 10, later)).toHaveLength(0);
  });
});
