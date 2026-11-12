import Decimal from "decimal.js";
import { DigitalChannels } from "./DigitalChannels";
import { ServiceChannels } from "./ServiceChannels";
import { validarCoberturaFSD, type CoberturaFSD } from "../../fsd/CoberturaFSD";

// Depósito a plazo fijo que ofrece una entidad. TEA como fracción (5 % = 0.05);
// minimumAmount es el monto mínimo de apertura; channels, sus canales de atención (US18);
// digitalChannels, si tiene banca digital y app móvil (US19).
export class FinancialProduct {
  readonly coberturaFSD: CoberturaFSD;
  constructor(
    readonly id: number,
    readonly entityName: string,
    readonly tea: Decimal,
    readonly minimumAmount: Decimal,
    readonly channels: ServiceChannels,
    coberturaFSD?: unknown,
    readonly digitalChannels: DigitalChannels = new DigitalChannels(false, false),
  ) { this.coberturaFSD = validarCoberturaFSD(coberturaFSD); }
}
