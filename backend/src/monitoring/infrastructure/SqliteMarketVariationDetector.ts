import Decimal from "decimal.js";
import type { DatabaseSync } from "node:sqlite";
import type { MarketSnapshot, MarketVariationDetector } from "../domain/MonitoringContracts";
import type { AlertEvent } from "../../notifications/queue/domain/QueueContracts";
import { isoDate, userId, validateEvent } from "../../notifications/queue/domain/QueueValidation";

export function rateChangeThreshold(value = "0"): string {
  if (!/^\d+(\.\d+)?$/.test(value) || !new Decimal(value).isFinite()) {
    throw new TypeError("MARKET_RATE_CHANGE_THRESHOLD debe ser una fracción decimal no negativa.");
  }
  return new Decimal(value).toString();
}

/** Referencia persistida y outbox atómica. No calcula ni inventa calificaciones de riesgo. */
export class SqliteMarketVariationDetector implements MarketVariationDetector {
  private readonly threshold: Decimal;
  constructor(private readonly database: DatabaseSync, threshold = "0") {
    this.threshold = new Decimal(rateChangeThreshold(threshold));
    database.exec(`CREATE TABLE IF NOT EXISTS market_monitoring_baseline (
      product_id INTEGER PRIMARY KEY, snapshot_json TEXT NOT NULL, revision INTEGER NOT NULL
    ); CREATE TABLE IF NOT EXISTS market_change_outbox (
      event_id TEXT PRIMARY KEY, event_json TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1))
    )`);
  }

  async detect(snapshots: readonly MarketSnapshot[], signal: AbortSignal): Promise<AlertEvent[]> {
    signal.throwIfAborted();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const seen = new Set<number>();
      for (const snapshot of snapshots) {
        signal.throwIfAborted();
        userId(snapshot.productId); userId(snapshot.entityId); isoDate(snapshot.observedAt);
        if (seen.has(snapshot.productId)) throw new Error("Instantánea de producto duplicada.");
        seen.add(snapshot.productId);
        const tea = new Decimal(snapshot.tea);
        if (!tea.isFinite() || tea.isNegative()) throw new TypeError("TEA inválida.");
        const row = this.database.prepare("SELECT snapshot_json, revision FROM market_monitoring_baseline WHERE product_id=?")
          .get(snapshot.productId) as { snapshot_json: string; revision: number } | undefined;
        const previous: MarketSnapshot | undefined = row ? JSON.parse(row.snapshot_json) : undefined;
        if (previous && snapshot.observedAt < previous.observedAt) continue;
        // Una ausencia temporal de riesgo no borra la última observación válida.
        const current = { ...snapshot, riskRating: snapshot.riskRating ?? previous?.riskRating ?? null };
        let revision = row?.revision ?? 0;
        if (previous && previous.entityId !== current.entityId) throw new Error("Cambió la identidad de la entidad del producto.");
        const rateChanged = previous && !tea.equals(previous.tea);
        const riskChanged = previous && previous.riskRating !== null && current.riskRating !== null && previous.riskRating !== current.riskRating;
        if (rateChanged || riskChanged) revision++;
        if (!Number.isSafeInteger(revision)) throw new RangeError("Revisión fuera de rango.");
        const events: AlertEvent[] = [];
        const common = { entityId: current.entityId, occurredAt: current.observedAt };
        if (previous && rateChanged && tea.minus(previous.tea).abs().greaterThan(this.threshold)) {
          events.push({ ...common, eventId: `market:${current.productId}:${revision}:CAMBIO_TASA`,
            type: "CAMBIO_TASA", previousValue: previous.tea, currentValue: tea.toString() });
        }
        if (previous && riskChanged) {
          events.push({ ...common, eventId: `market:${current.productId}:${revision}:CAMBIO_RIESGO`,
            type: "CAMBIO_RIESGO", previousValue: previous.riskRating!, currentValue: current.riskRating! });
        }
        for (const event of events) {
          this.database.prepare("INSERT INTO market_change_outbox(event_id,event_json) VALUES (?,?)")
            .run(event.eventId, JSON.stringify(validateEvent(event)));
        }
        this.database.prepare(`INSERT INTO market_monitoring_baseline(product_id,snapshot_json,revision) VALUES (?,?,?)
          ON CONFLICT(product_id) DO UPDATE SET snapshot_json=excluded.snapshot_json,revision=excluded.revision`)
          .run(current.productId, JSON.stringify(current), revision);
      }
      const pending = this.database.prepare("SELECT event_json FROM market_change_outbox WHERE published=0 ORDER BY rowid").all();
      this.database.exec("COMMIT");
      return pending.map((row) => JSON.parse(String(row.event_json)) as AlertEvent);
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }

  async acknowledge(events: readonly AlertEvent[]): Promise<void> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      for (const event of events) this.database.prepare("UPDATE market_change_outbox SET published=1 WHERE event_id=?").run(event.eventId);
      this.database.exec("COMMIT");
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
}
