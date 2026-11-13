import type { SbsRiskProfile } from "./SbsRiskProfile";

// US26: informe del economista sobre una entidad. entityId es el mismo productId de plazo fijo.
export class EconomistReport {
  constructor(
    readonly entityId: number,
    readonly entityName: string,
    readonly summary: string,
    readonly strengths: string[],
    readonly risks: string[],
    readonly recommendation: string,
    readonly author: string,
    readonly publishedAt: Date,
  ) {}

  // Los indicadores de la SBS (US25) los agrega EconomistReportService
  sbsProfile: SbsRiskProfile | null = null;
}
