import { readFileSync } from "node:fs";
import path from "node:path";
import { EconomistReport } from "../domain/EconomistReport";
import type { EconomistReportRepository } from "../domain/EconomistReportRepository";

interface InformeJson {
  entityId: number;
  entityName: string;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendation: string;
  author: string;
  publishedAt: string;
}

// US26 (TS-82): lee los informes de data/informes.json. Son datos de demostración.
export class JsonEconomistReportRepository implements EconomistReportRepository {
  constructor(private readonly filePath = path.join(process.cwd(), "data", "informes.json")) {}

  // Se lee en cada consulta: así un informe nuevo aparece sin reiniciar el servidor
  findByEntityId(entityId: number): EconomistReport | null {
    const datos: unknown = JSON.parse(readFileSync(this.filePath, "utf-8"));
    if (!Array.isArray(datos)) {
      throw new Error(`${this.filePath} debe contener un arreglo de informes`);
    }
    const informe = (datos as InformeJson[]).find((i) => i.entityId === entityId);
    if (!informe) return null;

    return new EconomistReport(
      informe.entityId,
      informe.entityName,
      informe.summary,
      informe.strengths,
      informe.risks,
      informe.recommendation,
      informe.author,
      new Date(informe.publishedAt),
    );
  }
}
