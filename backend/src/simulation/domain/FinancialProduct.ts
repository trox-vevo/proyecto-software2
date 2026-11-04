import Decimal from "decimal.js";
import { ServiceChannels } from "./ServiceChannels";
import { validarCoberturaFSD, type CoberturaFSD } from "../../fsd/CoberturaFSD";

// Depósito a plazo fijo que ofrece una entidad. TEA como fracción (5 % = 0.05);
// minimumAmount es el monto mínimo de apertura; channels, sus canales de atención (US18).
export class FinancialProduct {
  readonly coberturaFSD: CoberturaFSD;
  constructor(
    readonly id: number,
    readonly entityName: string,
    readonly tea: Decimal,
    readonly minimumAmount: Decimal,
    readonly channels: ServiceChannels,
    coberturaFSD?: unknown,
  ) { this.coberturaFSD = validarCoberturaFSD(coberturaFSD); }
}
