/** US25: datos de riesgo de una entidad según la SBS. Los ratios llegan como texto y en fracción ("0.1620" = 16.20 %). */
export interface SbsRiskProfile {
  entityId: number;
  entityName: string;
  /** Calificación de la SBS: A+, A, A-, B+, ... E */
  riskRating: string;
  capitalAdequacyRatio: string;
  delinquencyRate: string;
  liquidityRatio: string;
  /** Fecha del reporte, "2026-09-30" */
  reportDate: string;
  sourceUrl: string;
}
