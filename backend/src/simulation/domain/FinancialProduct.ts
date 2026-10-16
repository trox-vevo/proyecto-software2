import Decimal from "decimal.js";

// Depósito a plazo fijo que ofrece una entidad. TEA como fracción (5 % = 0.05);
// minimumAmount es el monto mínimo de apertura de esa entidad.
export class FinancialProduct {
  constructor(
    readonly id: number,
    readonly entityName: string,
    readonly tea: Decimal,
    readonly minimumAmount: Decimal,
  ) {}
}
