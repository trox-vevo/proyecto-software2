import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";
import { SqliteFavoriteRepository } from "../../src/favorites/infrastructure/SqliteFavoriteRepository";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";
import { createMarketMonitoringRuntime, monitoringSettings } from "../../src/monitoring/infrastructure/createMarketMonitoringRuntime";
import { changeDemoRate } from "../../src/monitoring/infrastructure/changeDemoRate";
import { PaymentMode } from "../../src/simulation/domain/PaymentMode";
import { createApp } from "../../src/app";
import { SqliteProductRepository } from "../../src/simulation/infrastructure/SqliteProductRepository";
import { ServicioAlertas } from "../../src/alertas/application/ServicioAlertas";
import { SqliteAlertasRepository } from "../../src/alertas/infrastructure/SqliteAlertasRepository";
import { ServicioEnvioCorreo } from "../../src/alertas/application/ServicioEnvioCorreo";
import { SqliteResolvedorAlertaCorreo } from "../../src/alertas/infrastructure/SqliteResolvedorAlertaCorreo";
import { AutorizadorEnvioPro } from "../../src/alertas/infrastructure/AutorizadorEnvioPro";
import { ProAccessService } from "../../src/auth/application/ProAccessService";
import { NotificationPreferencesService } from "../../src/notifications/NotificationPreferencesService";
import { rateChangeThreshold } from "../../src/monitoring/infrastructure/SqliteMarketVariationDetector";
import { SqliteMarketVariationDetector } from "../../src/monitoring/infrastructure/SqliteMarketVariationDetector";
import { SqliteMarketDataProvider } from "../../src/monitoring/infrastructure/SqliteMarketDataProvider";

let dir: string;
let file: string;
let users: SqliteUserRepository;
let favorites: SqliteFavoriteRepository;
let db: ReturnType<typeof openDatabase>;
const config = { enabled: false, intervalMs: 100 };
const now = () => new Date().toISOString();
const makeUser = (email: string, plan: "PRO" | "BASICO" = "PRO") => users.create({
  username: email, email, plan, passwordHash: "solo-fixture", createdAt: now(),
}).id;
function follow(userId: number, productId = 1, fingerprint = "favorito") {
  favorites.save({ userId, fingerprint, parameters: { instrument: "PLAZO_FIJO", productId,
    amount: "1000.00", termDays: 360, department: "Lima", paymentMode: PaymentMode.AT_MATURITY },
  snapshot: {}, createdAt: now() });
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "yupay-automatic-")); file = join(dir, "demo.sqlite");
  users = new SqliteUserRepository(file); favorites = new SqliteFavoriteRepository(file); db = openDatabase(file);
});
afterEach(() => {
  vi.useRealTimers(); db.close(); favorites.close(); users.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep + "yupay-automatic-")) throw new Error("Temporal inesperado");
  rmSync(dir, { recursive: true });
});

describe("Alertas automáticas con detector y cruce reales", () => {
  it.each(["-1", "NaN", "Infinity", "", "0,5"])("rechaza umbral inválido %s", (value) => {
    expect(() => rateChangeThreshold(value)).toThrow();
  });
  it("habilita monitoreo por defecto sin generar alertas en la primera lectura", async () => {
    expect(monitoringSettings({}).enabled).toBe(true);
    const runtime = createMarketMonitoringRuntime(db, users, config);
    await runtime.job.runOnce(); await runtime.stop();
    expect(runtime.queue.pending("INMEDIATA", 10, now())).toEqual([]);
  });
  it("el temporizador detecta el cambio, la API lo muestra y US40 confirma la entrega", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const id = makeUser("pro@example.test"); follow(id); follow(id, 1, "otro-favorito");
    const runtime = createMarketMonitoringRuntime(db, users, { enabled: true, intervalMs: 100 });
    await runtime.job.runOnce();
    changeDemoRate(file, 1, "0.075123456789123456");
    await vi.advanceTimersByTimeAsync(100);
    const [message] = runtime.queue.pending("INMEDIATA", 10, now());
    expect(message.event.currentValue).toBe("0.075123456789123456");
    await vi.advanceTimersByTimeAsync(200);
    expect(runtime.queue.pending("INMEDIATA", 10, now())).toHaveLength(1);
    const alertas = new ServicioAlertas(new SqliteAlertasRepository(db));
    const server = createApp(new SqliteProductRepository(db), users, users, undefined, undefined,
      { alertas, resolveUser: async () => ({ id, plan: "PRO" }) }).listen(0);
    try {
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Puerto inválido");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/alertas`);
      expect(response.status).toBe(200);
      expect((await response.json()).alertas).toHaveLength(1);
      const provider = { enviar: vi.fn().mockResolvedValue(true) };
      const sender = new ServicioEnvioCorreo({ cola: runtime.queue, usuarios: users,
        alertas: new SqliteResolvedorAlertaCorreo(db), proveedor: provider,
        registro: { registrarIntento: vi.fn(), registrarAgotado: vi.fn(), registrarAviso: vi.fn() },
        temporizador: { esperar: vi.fn() },
        autorizador: new AutorizadorEnvioPro(new ProAccessService(users), new NotificationPreferencesService(users)) });
      expect(await sender.procesarLote()).toBe(1);
      expect(provider.enviar).toHaveBeenCalledOnce();
      expect(runtime.queue.findById(message.id)?.status).toBe("SENT");
    } finally {
      await runtime.stop(); server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it("cruza favoritos, plan vigente, tipo de alerta y frecuencia; conserva resumen diario", async () => {
    const immediate = makeUser("immediate@example.test"); follow(immediate);
    const daily = makeUser("daily@example.test"); follow(daily);
    users.saveNotificationPreferences(daily, { alertTypes: ["CAMBIO_TASA"], frequency: "RESUMEN_DIARIO" });
    const basic = makeUser("basic@example.test", "BASICO"); follow(basic);
    const excluded = makeUser("excluded@example.test"); follow(excluded);
    users.saveNotificationPreferences(excluded, { alertTypes: ["CAMBIO_RIESGO"], frequency: "INMEDIATA" });
    const expired = makeUser("expired@example.test"); follow(expired);
    db.prepare("UPDATE users SET plan_expires_at=? WHERE id=?").run("2000-01-01T00:00:00.000Z", expired);
    makeUser("unfollowed@example.test");
    const other = makeUser("other@example.test"); follow(other, 2);
    const runtime = createMarketMonitoringRuntime(db, users, config);
    await runtime.job.runOnce(); changeDemoRate(file, 1, "0.08"); await runtime.job.runOnce(); await runtime.stop();
    expect(runtime.queue.pending("INMEDIATA", 10, now()).map((m) => m.userId)).toEqual([immediate]);
    const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
    expect(runtime.queue.pending("RESUMEN_DIARIO", 10, now())).toEqual([]);
    expect(runtime.queue.pending("RESUMEN_DIARIO", 10, tomorrow.toISOString()).map((m) => m.userId)).toEqual([daily]);
  });
  it("conserva evento pendiente si falla la publicación, lo recupera al reiniciar sin duplicados", async () => {
    const id = makeUser("retry@example.test"); follow(id);
    const first = createMarketMonitoringRuntime(db, users, config, { logger: { error: vi.fn() } });
    await first.job.runOnce();
    vi.spyOn(first.publisher, "publish").mockRejectedValueOnce(new Error("fallo temporal"));
    changeDemoRate(file, 1, "0.08"); await first.job.runOnce(); await first.stop();
    const row = db.prepare("SELECT event_id FROM market_change_outbox WHERE published=0").get();
    expect(row).toBeDefined();
    db.close(); db = openDatabase(file);
    const restarted = createMarketMonitoringRuntime(db, users, config);
    await restarted.job.runOnce(); await restarted.job.runOnce(); await restarted.stop();
    expect(restarted.queue.pending("INMEDIATA", 10, now()).map((m) => m.event.eventId)).toEqual([row!.event_id]);
    expect(db.prepare("SELECT event_id FROM market_change_outbox WHERE published=0").all()).toEqual([]);
  });
  it("distingue oscilaciones repetidas y persiste la referencia entre reinicios", async () => {
    const id = makeUser("waves@example.test"); follow(id);
    const runtime = createMarketMonitoringRuntime(db, users, config);
    await runtime.job.runOnce();
    for (const tea of ["0.08", "0.07", "0.08"]) { changeDemoRate(file, 1, tea); await runtime.job.runOnce(); }
    await runtime.stop(); db.close(); db = openDatabase(file);
    const restarted = createMarketMonitoringRuntime(db, users, config);
    await restarted.job.runOnce(); await restarted.stop();
    const messages = restarted.queue.pending("INMEDIATA", 10, now());
    expect(messages).toHaveLength(3);
    expect(new Set(messages.map((m) => m.event.eventId)).size).toBe(3);
  });
  it("aplica el umbral decimal y detecta cambios de calificación", async () => {
    const id = makeUser("threshold@example.test"); follow(id);
    changeDemoRate(file, 1, "0.05");
    const runtime = createMarketMonitoringRuntime(db, users, { ...config, rateThreshold: "0.005" });
    await runtime.job.runOnce(); changeDemoRate(file, 1, "0.055"); await runtime.job.runOnce();
    expect(runtime.queue.pending("INMEDIATA", 10, now())).toEqual([]);
    changeDemoRate(file, 1, "0.065");
    db.exec("UPDATE sbs_risk_profiles SET risk_rating='C' WHERE entity_id=1");
    await runtime.job.runOnce(); await runtime.stop();
    expect(runtime.queue.pending("INMEDIATA", 10, now()).map((m) => m.event.type)).toEqual(["CAMBIO_TASA", "CAMBIO_RIESGO"]);
  });
  it("una observación tardía no revierte el estado de otra más reciente", async () => {
    const detector = new SqliteMarketVariationDetector(db);
    const provider = new SqliteMarketDataProvider(db, () => new Date("2026-11-15T12:00:00.000Z"));
    const signal = new AbortController().signal;
    const { snapshots } = await provider.fetchCurrent(signal);
    await detector.detect(snapshots, signal);
    const current = snapshots.map((s) => ({ ...s, tea: "0.09", observedAt: "2026-11-15T13:00:00.000Z" }));
    const events = await detector.detect(current, signal); await detector.acknowledge(events);
    expect(await detector.detect(snapshots, signal)).toEqual([]);
  });
});
