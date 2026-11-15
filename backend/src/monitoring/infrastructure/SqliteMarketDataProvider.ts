import type { DatabaseSync } from "node:sqlite";
import Decimal from "decimal.js";
import { numericIdentifier } from "../../registration/domain/NumericIdentifier";
import { SqliteSbsRiskRepository } from "../../risk/infrastructure/SqliteSbsRiskRepository";
import type { MarketDataProvider, MarketSnapshot, SnapshotBatch } from "../domain/MonitoringContracts";

/** Lectura del catálogo local. No consulta SBS ni bancos por Internet. */
export class SqliteMarketDataProvider implements MarketDataProvider {
  constructor(private readonly database: DatabaseSync, private readonly now: () => Date = () => new Date()) {}

  async fetchCurrent(signal: AbortSignal): Promise<SnapshotBatch> {
    const rows = this.database.prepare("SELECT id, entity_id, tea FROM fixed_deposit_products ORDER BY id").all();
    const risk = new SqliteSbsRiskRepository(this.database);
    const snapshots: MarketSnapshot[] = [];
    const errors: string[] = [];
    for (const row of rows) {
      signal.throwIfAborted();
      try {
        const entityId = numericIdentifier(row.entity_id);
        const productId = numericIdentifier(row.id);
        const tea = new Decimal(String(row.tea));
        if (!tea.isFinite()) throw new Error("TEA no finita");
        const snapshot: MarketSnapshot = { entityId, productId, tea: tea.toString(),
          riskRating: null, indicators: {}, observedAt: this.now().toISOString(), riskReportedAt: null,
          source: { kind: "SQLITE_DEMO", riskSourceUrl: null } };
        try {
          const profile = risk.findByEntityId(entityId);
          if (profile) {
            const indicators = { capitalAdequacyRatio: profile.capitalAdequacyRatio.toString(),
              delinquencyRate: profile.delinquencyRate.toString(), liquidityRatio: profile.liquidityRatio.toString() };
            if (Object.values(indicators).some((value) => !new Decimal(value).isFinite())) throw new Error("Indicador no finito");
            snapshot.riskReportedAt = profile.reportDate.toISOString();
            snapshot.riskRating = profile.riskRating;
            snapshot.indicators = indicators;
            snapshot.source.riskSourceUrl = profile.sourceUrl;
          }
        } catch (error) { errors.push(`Riesgo de entidad ${entityId}: ${String(error)}`); }
        snapshots.push(snapshot);
      } catch (error) { errors.push(`Producto ${String(row.id)}: ${String(error)}`); }
    }
    return { snapshots, errors };
  }
}
