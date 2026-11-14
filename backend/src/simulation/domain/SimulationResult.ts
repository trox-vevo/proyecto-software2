import Decimal from "decimal.js";
import { DigitalChannels } from "./DigitalChannels";
import { ServiceChannels } from "./ServiceChannels";
import { crearCoberturaNoVerificada, type CoberturaFSD } from "../../fsd/CoberturaFSD";

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
    readonly channels: ServiceChannels,
    readonly coberturaFSD: CoberturaFSD = crearCoberturaNoVerificada(),
    readonly minimumAmount: Decimal | null = null,
    // US19: banca digital y app móvil de la entidad
    readonly digitalChannels: DigitalChannels = new DigitalChannels(false, false),
  ) {}

  // US25 lo llena; US27 lo borra para usuarios no Pro
  riskRating: string | null = null;

  hideRiskRating(): void {
    this.riskRating = null;
  }

  // US25: calificación de la SBS que pone RiskEvaluationService
  assignRiskRating(riskRating: string): void {
    this.riskRating = riskRating;
  }
}
