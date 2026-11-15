import Decimal from "decimal.js";
import type { DatabaseSync } from "node:sqlite";
import { SbsRiskProfile } from "../domain/SbsRiskProfile";
import type { SbsRiskRepository } from "../domain/SbsRiskRepository";

interface SbsRow {
  entity_id: number;
  name: string;
  risk_rating: string;
  capital_adequacy_ratio: string;
  delinquency_rate: string;
  liquidity_ratio: string;
  report_date: string;
  source_url: string;
}

// US25: indicadores de la SBS desde la base única (antes: data/sbs.json)
export class SqliteSbsRiskRepository implements SbsRiskRepository {
  constructor(private readonly database: DatabaseSync) {}

  findByEntityId(entityId: number): SbsRiskProfile | null {
    const row = this.database.prepare(`
      SELECT s.*, e.name FROM sbs_risk_profiles s JOIN financial_entities e ON e.id = s.entity_id
      WHERE s.entity_id = ?`).get(entityId) as unknown as SbsRow | undefined;
    if (!row) return null;
    return new SbsRiskProfile(
      row.entity_id,
      row.name,
      row.risk_rating,
      new Decimal(row.capital_adequacy_ratio),
      new Decimal(row.delinquency_rate),
      new Decimal(row.liquidity_ratio),
      new Date(row.report_date),
      row.source_url,
    );
  }
}
