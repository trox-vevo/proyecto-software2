import type { AlertEvent } from "../../notifications/queue/domain/QueueContracts";

export interface MarketSnapshot {
  entityId: number;
  productId: number;
  tea: string;
  riskRating: string | null;
  indicators: Readonly<Record<string, string>>;
  observedAt: string;
  riskReportedAt: string | null;
  source: { kind: "SQLITE_DEMO"; riskSourceUrl: string | null };
}

export interface MonitoringLogger { error(message: string, error: unknown): void }
export interface SnapshotBatch { snapshots: MarketSnapshot[]; errors: string[] }
export interface MarketDataProvider { fetchCurrent(signal: AbortSignal): Promise<SnapshotBatch> }
/** TS-117 conserva y compara sus instantáneas. TS-116 solo entrega el lote. */
export interface MarketVariationDetector {
  detect(snapshots: readonly MarketSnapshot[], signal: AbortSignal): Promise<AlertEvent[]>;
}
export interface MarketChangePublisher { publish(events: readonly AlertEvent[]): Promise<void> }
export interface CycleResult {
  executedAt: string;
  reviewedProducts: number;
  detectedChanges: number;
  status: "OK" | "PARTIAL";
  errors: readonly string[];
}
export interface MonitoringCycle { executeCycle(signal: AbortSignal): Promise<CycleResult> }
export interface MonitoringConfiguration { intervalMs: number }
