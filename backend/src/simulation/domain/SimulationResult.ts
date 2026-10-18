import Decimal from "decimal.js";

// Resultado de simular un producto: lo que muestra la tabla del frontend (US12).
// Los montos ya vienen redondeados a 2 decimales.
export class SimulationResult {
  constructor(
    readonly productId: number,
    readonly entityName: string,
    readonly tea: Decimal,
    readonly totalInterest: Decimal,
    // null en AT_MATURITY: el interés mensual no aplica
    readonly monthlyInterest: Decimal | null,
    readonly minimumAmount: Decimal,
  ) {}
}
