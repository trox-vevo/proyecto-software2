import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";
import { createMarketMonitoringRuntime, monitoringSettings } from "../../src/monitoring/infrastructure/createMarketMonitoringRuntime";
import { createApp } from "../../src/app";
import { SqliteNotificationQueueRepository } from "../../src/notifications/queue/infrastructure/SqliteNotificationQueueRepository";
import type { AlertEvent } from "../../src/notifications/queue/domain/QueueContracts";

let dir: string;
let users: SqliteUserRepository;
let database: ReturnType<typeof openDatabase>;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "yupay-market-")); file = join(dir, "app.sqlite");
  users = new SqliteUserRepository(file); database = openDatabase(file);
});
afterEach(() => {
  vi.useRealTimers(); database.close(); users.close();
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep + "yupay-market-")) throw new Error("Ruta inesperada");
  rmSync(dir, { recursive: true });
});

describe("TS-116 y TS-121 composición interna", () => {
  it.each([{ MARKET_MONITORING_ENABLED: "yes" }, { MARKET_MONITORING_INTERVAL_MS: "0" },
    { MARKET_MONITORING_INTERVAL_MS: "-1" }, { MARKET_MONITORING_INTERVAL_MS: "abc" }])("rechaza configuración %j", (config) => {
    expect(() => monitoringSettings(config)).toThrow();
  });
  it("por defecto no agenda ciclos ni genera alertas", async () => {
    vi.useFakeTimers();
    const provider = { fetchCurrent: vi.fn() };
    const runtime = createMarketMonitoringRuntime(database, users, monitoringSettings({}), { provider });
    await vi.advanceTimersByTimeAsync(120000); await runtime.stop();
    expect(provider.fetchCurrent).not.toHaveBeenCalled();
    expect(runtime.publisher).toBeUndefined();
  });
  it("inicia por configuración, se recupera de errores y Express continúa disponible", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const provider = { fetchCurrent: vi.fn().mockRejectedValueOnce(new Error("fuente caída"))
      .mockResolvedValue({ snapshots: [], errors: [] }) };
    const logger = { error: vi.fn() };
    const runtime = createMarketMonitoringRuntime(database, users, { enabled: true, intervalMs: 100 }, { provider, logger });
    await runtime.job.runOnce();
    const server = createApp().listen(0);
    try {
      await once(server, "listening");
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Puerto no disponible");
      expect((await fetch(`http://127.0.0.1:${address.port}/api/health`)).status).toBe(200);
      expect(logger.error).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(100);
      expect(provider.fetchCurrent).toHaveBeenCalledTimes(2);
      await runtime.stop(); await vi.advanceTimersByTimeAsync(1000);
      expect(provider.fetchCurrent).toHaveBeenCalledTimes(2);
    } finally { await runtime.stop(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
  it("conecta falsos TS-117/TS-120 al encolado real, sin duplicar por reintento y persiste", async () => {
    const user = users.create({ username: "Pro", email: "pro@example.test", passwordHash: "fixture", plan: "PRO", createdAt: new Date().toISOString() });
    const event: AlertEvent = { eventId: "test-change", entityId: 1, type: "CAMBIO_TASA",
      previousValue: "0.05", currentValue: "0.06", occurredAt: "2026-01-01T00:00:00.000Z" };
    const detector = { detect: vi.fn().mockResolvedValue([event]) };
    const matcher = { findEligible: vi.fn().mockResolvedValue([{ userId: user.id, eventId: event.eventId, frequency: "INMEDIATA" }]) };
    const runtime = createMarketMonitoringRuntime(database, users, { enabled: false, intervalMs: 100 }, { detector, matcher });
    await runtime.job.runOnce(); await runtime.job.runOnce(); await runtime.stop();
    expect(detector.detect).toHaveBeenCalledTimes(2);
    expect(detector.detect.mock.calls[0][0].length).toBeGreaterThan(0);
    database.close(); database = openDatabase(file);
    const queue = new SqliteNotificationQueueRepository(database);
    expect(queue.pending("INMEDIATA", 10, new Date().toISOString())).toHaveLength(1);
  });
  it("rechaza conectar detector sin motor de cruce", () => {
    expect(() => createMarketMonitoringRuntime(database, users, { enabled: false, intervalMs: 100 }, {
      detector: { detect: vi.fn() },
    })).toThrow();
  });
});
