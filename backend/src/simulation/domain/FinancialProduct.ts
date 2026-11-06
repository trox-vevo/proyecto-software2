import Decimal from "decimal.js";
import { DigitalChannels } from "./DigitalChannels";
import { ServiceChannels } from "./ServiceChannels";

// Depósito a plazo fijo que ofrece una entidad. TEA como fracción (5 % = 0.05);
// minimumAmount es el monto mínimo de apertura; channels, sus canales de atención (US18);
// digitalChannels, si tiene banca digital y app móvil (US19).
export class FinancialProduct {
  constructor(
    readonly id: number,
    readonly entityName: string,
    readonly tea: Decimal,
    readonly minimumAmount: Decimal,
    readonly channels: ServiceChannels,
    readonly digitalChannels: DigitalChannels,
  ) {}
}
