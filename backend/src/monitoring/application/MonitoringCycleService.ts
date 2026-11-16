import type { MarketDataProvider, MarketVariationDetector, MarketChangePublisher, MonitoringCycle, CycleResult } from "../domain/MonitoringContracts";

export class MonitoringCycleService implements MonitoringCycle {
  constructor(private readonly provider: MarketDataProvider,
    private readonly detector?: MarketVariationDetector,
    private readonly publisher?: MarketChangePublisher,
    private readonly now: () => Date = () => new Date()) {}

  async executeCycle(signal: AbortSignal): Promise<CycleResult> {
    signal.throwIfAborted();
    const batch = await this.provider.fetchCurrent(signal);
    signal.throwIfAborted();
    const events = this.detector ? await this.detector.detect(batch.snapshots, signal) : [];
    signal.throwIfAborted();
    if (events.length) {
      if (!this.publisher) throw new Error("Los eventos detectados requieren un receptor configurado.");
      await this.publisher.publish(events);
      await this.detector?.acknowledge?.(events);
    }
    return { executedAt: this.now().toISOString(), reviewedProducts: batch.snapshots.length,
      detectedChanges: events.length, status: batch.errors.length ? "PARTIAL" : "OK", errors: batch.errors };
  }
}
