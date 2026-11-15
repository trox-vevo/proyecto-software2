import type { CycleResult, MonitoringConfiguration, MonitoringCycle, MonitoringLogger } from "../domain/MonitoringContracts";

export function monitoringInterval(value: string | number = 60_000): number {
  if (typeof value === "string" && !/^\d+$/.test(value)) throw new RangeError("Intervalo de monitoreo inválido.");
  const interval = Number(value);
  if (!Number.isSafeInteger(interval) || interval < 1 || interval > 2_147_483_647) {
    throw new RangeError("El intervalo debe estar entre 1 y 2147483647 ms.");
  }
  return interval;
}

export class MarketMonitoringJob {
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeRun: Promise<CycleResult | undefined> | null = null;
  private controller: AbortController | null = null;
  private stopped = false;
  private stopping = false;
  private readonly intervalMs: number;

  constructor(private readonly cycle: MonitoringCycle, config: MonitoringConfiguration,
    private readonly logger: MonitoringLogger = console) {
    this.intervalMs = monitoringInterval(config.intervalMs);
  }

  start(): void {
    if (this.timer || this.stopping) return;
    this.stopped = false;
    this.timer = setInterval(() => { void this.runOnce(); }, this.intervalMs);
    void this.runOnce();
  }

  runOnce(): Promise<CycleResult | undefined> {
    if (this.stopped) return Promise.resolve(undefined);
    if (this.activeRun) return this.activeRun;
    const controller = new AbortController();
    this.controller = controller;
    this.activeRun = Promise.resolve().then(() => this.cycle.executeCycle(controller.signal))
      .then((result) => {
        if (result.errors.length) {
          try { this.logger.error("Ciclo de monitoreo parcial.", result.errors); } catch { /* conservar el resultado */ }
        }
        return result;
      })
      .catch((error: unknown) => {
        // Un logger defectuoso tampoco debe producir un rechazo sin manejar.
        try { this.logger.error("Falló el ciclo de monitoreo.", error); } catch { /* mantener el job */ }
        return undefined;
      }).finally(() => { this.activeRun = null; this.controller = null; });
    return this.activeRun;
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.controller?.abort();
    // Drenar evita cerrar SQLite mientras un adaptador todavía lo está usando.
    await this.activeRun;
    this.stopping = false;
  }
}
