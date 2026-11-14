import { readFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { SbsRiskProfile } from "../domain/SbsRiskProfile";
import type { SbsRiskRepository } from "../domain/SbsRiskRepository";

interface PerfilJson {
  entityId: number;
  entityName: string;
  riskRating: string;
  capitalAdequacyRatio: string;
  delinquencyRate: string;
  liquidityRatio: string;
  reportDate: string;
  sourceUrl: string;
}

// US25 (TS-78): lee los datos de riesgo de data/sbs.json. Son datos de demostración.
export class JsonSbsRiskRepository implements SbsRiskRepository {
  private perfiles: Map<number, SbsRiskProfile> | null = null;

  constructor(private readonly filePath = path.join(process.cwd(), "data", "sbs.json")) {}

  findByEntityId(entityId: number): SbsRiskProfile | null {
    return this.cargar().get(entityId) ?? null;
  }

  // Se lee una sola vez, la primera vez que se pide un perfil
  private cargar(): Map<number, SbsRiskProfile> {
    if (this.perfiles) return this.perfiles;

    const datos: unknown = JSON.parse(readFileSync(this.filePath, "utf-8"));
    if (!Array.isArray(datos)) {
      throw new Error(`${this.filePath} debe contener un arreglo de perfiles`);
    }
    this.perfiles = new Map(
      (datos as PerfilJson[]).map((p) => [
        p.entityId,
        new SbsRiskProfile(
          p.entityId,
          p.entityName,
          p.riskRating,
          new Decimal(p.capitalAdequacyRatio),
          new Decimal(p.delinquencyRate),
          new Decimal(p.liquidityRatio),
          new Date(p.reportDate),
          p.sourceUrl,
        ),
      ]),
    );
    return this.perfiles;
  }
}
