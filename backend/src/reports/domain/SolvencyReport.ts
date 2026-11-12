import type Decimal from "decimal.js";
import type { PaymentMode } from "../../simulation/domain/PaymentMode";
import type { SimulationResult } from "../../simulation/domain/SimulationResult";

// US30: datos de un Reporte de Solvencia: los parámetros de la simulación y sus resultados.
export interface SolvencyReport {
  amount: Decimal;
  termDays: number;
  department: string;
  paymentMode: PaymentMode;
  results: SimulationResult[];
  generatedAt: Date;
}
