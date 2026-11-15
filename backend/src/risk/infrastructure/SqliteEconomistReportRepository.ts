import type { DatabaseSync } from "node:sqlite";
import { EconomistReport } from "../domain/EconomistReport";
import type { EconomistReportRepository } from "../domain/EconomistReportRepository";

interface ReportRow {
  entity_id: number;
  name: string;
  summary: string;
  strengths: string;
  risks: string;
  recommendation: string;
  author: string;
  published_at: string;
}

// US26: informe del economista desde la base única (antes: data/informes.json)
export class SqliteEconomistReportRepository implements EconomistReportRepository {
  constructor(private readonly database: DatabaseSync) {}

  findByEntityId(entityId: number): EconomistReport | null {
    const row = this.database.prepare(`
      SELECT r.*, e.name FROM economist_reports r JOIN financial_entities e ON e.id = r.entity_id
      WHERE r.entity_id = ?`).get(entityId) as unknown as ReportRow | undefined;
    if (!row) return null;
    return new EconomistReport(
      row.entity_id,
      row.name,
      row.summary,
      JSON.parse(row.strengths) as string[],
      JSON.parse(row.risks) as string[],
      row.recommendation,
      row.author,
      new Date(row.published_at),
    );
  }
}
