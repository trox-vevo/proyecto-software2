import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketMonitoringJob, monitoringInterval } from "../../src/monitoring/application/MarketMonitoringJob";
import { MonitoringCycleService } from "../../src/monitoring/application/MonitoringCycleService";

const result = { executedAt: "2026-01-01T00:00:00.000Z", reviewedProducts: 0, detectedChanges: 0,
  status: "OK" as const, errors: [] };
afterEach(() => vi.useRealTimers());
describe("TS-116 job", () => {
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648, "", "abc", "1ms", "1.5"])("rechaza intervalo %s", (value) => {
    expect(() => monitoringInterval(value)).toThrow();
  });
  it("inicia una vez, respeta intervalo y no ejecuta después de stop", async () => {
    vi.useFakeTimers();
    const cycle = { executeCycle: vi.fn().mockResolvedValue(result) };
    const job = new MarketMonitoringJob(cycle, { intervalMs: 100 });
    job.start(); job.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(cycle.executeCycle).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(cycle.executeCycle).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(cycle.executeCycle).toHaveBeenCalledTimes(2);
    await job.stop();
    await vi.advanceTimersByTimeAsync(500);
    await job.runOnce();
    expect(cycle.executeCycle).toHaveBeenCalledTimes(2);
    job.start(); await vi.advanceTimersByTimeAsync(0); await job.stop();
    expect(cycle.executeCycle).toHaveBeenCalledTimes(3);
  });
  it("comparte la promesa activa, aborta y drena al detener", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    let activeSignal!: AbortSignal;
    const cycle = { executeCycle: vi.fn((signal: AbortSignal) => new Promise<typeof result>((resolve) => {
      activeSignal = signal; release = () => resolve(result);
    })) };
    const job = new MarketMonitoringJob(cycle, { intervalMs: 10 });
    job.start(); await vi.advanceTimersByTimeAsync(0);
    expect(job.runOnce()).toBe(job.runOnce());
    await vi.advanceTimersByTimeAsync(50);
    expect(cycle.executeCycle).toHaveBeenCalledTimes(1);
    let stopped = false;
    const stopping = job.stop().then(() => { stopped = true; });
    expect(activeSignal.aborted).toBe(true);
    expect(cycle.executeCycle.mock.calls[0]).toHaveLength(1);
    await Promise.resolve(); expect(stopped).toBe(false);
    job.start(); release(); await stopping;
    await vi.advanceTimersByTimeAsync(50);
    expect(cycle.executeCycle).toHaveBeenCalledTimes(1);
  });
  it("continúa tras fallo de consulta y de logger", async () => {
    vi.useFakeTimers();
    const cycle = { executeCycle: vi.fn().mockRejectedValueOnce(new Error("fuente caída")).mockResolvedValue(result) };
    const logger = { error: vi.fn(() => { throw new Error("logger caído"); }) };
    const job = new MarketMonitoringJob(cycle, { intervalMs: 10 }, logger);
    job.start(); await vi.advanceTimersByTimeAsync(10); await job.stop();
    expect(cycle.executeCycle).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
  it("entrega snapshots a TS-117 y eventos al publisher", async () => {
    const batch = { snapshots: [], errors: ["riesgo no disponible"] };
    const provider = { fetchCurrent: vi.fn().mockResolvedValue(batch) };
    const detector = { detect: vi.fn().mockResolvedValue([]) };
    const publisher = { publish: vi.fn() };
    const cycle = new MonitoringCycleService(provider, detector, publisher);
    const signal = new AbortController().signal;
    expect((await cycle.executeCycle(signal)).status).toBe("PARTIAL");
    expect(detector.detect).toHaveBeenCalledWith(batch.snapshots, signal);
    expect(publisher.publish).not.toHaveBeenCalled();
    detector.detect.mockResolvedValueOnce([{ eventId: "evento" }]);
    await cycle.executeCycle(signal);
    expect(publisher.publish).toHaveBeenCalledWith([{ eventId: "evento" }]);
  });
  it("un ciclo abortado no publica eventos tardíos", async () => {
    const controller = new AbortController();
    const provider = { fetchCurrent: vi.fn(async () => { controller.abort(); return { snapshots: [], errors: [] }; }) };
    const detector = { detect: vi.fn() };
    await expect(new MonitoringCycleService(provider, detector).executeCycle(controller.signal)).rejects.toThrow();
    expect(detector.detect).not.toHaveBeenCalled();
  });
  it("expone y reporta errores parciales sin perder el resultado", async () => {
    const partial = { ...result, status: "PARTIAL" as const, errors: ["fuente individual"] };
    const logger = { error: vi.fn() };
    const job = new MarketMonitoringJob({ executeCycle: vi.fn().mockResolvedValue(partial) }, { intervalMs: 100 }, logger);
    expect(await job.runOnce()).toEqual(partial);
    expect(logger.error).toHaveBeenCalledWith("Ciclo de monitoreo parcial.", partial.errors);
    await job.stop();
  });
  it("rechaza descartar eventos sin receptor", async () => {
    const cycle = new MonitoringCycleService({ fetchCurrent: vi.fn().mockResolvedValue({ snapshots: [], errors: [] }) },
      { detect: vi.fn().mockResolvedValue([{ eventId: "evento" }]) });
    await expect(cycle.executeCycle(new AbortController().signal)).rejects.toThrow("receptor");
  });
});
