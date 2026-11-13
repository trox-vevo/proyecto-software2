import Decimal from "decimal.js";

// US25: datos de riesgo de una entidad según la SBS. Los ratios van como fracción (14 % = 0.14).
// entityId es el mismo productId de plazo fijo.
export class SbsRiskProfile {
  constructor(
    readonly entityId: number,
    readonly entityName: string,
    // Calificación de la SBS: A+, A, A-, B+, ... E
    readonly riskRating: string,
    readonly capitalAdequacyRatio: Decimal,
    readonly delinquencyRate: Decimal,
    readonly liquidityRatio: Decimal,
    readonly reportDate: Date,
    readonly sourceUrl: string,
  ) {}
}
