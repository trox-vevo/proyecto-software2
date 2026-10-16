import Decimal from "decimal.js";
import { FinancialProduct } from "./FinancialProduct";
import { SimulationResult } from "./SimulationResult";

// Strategy: una implementación por modalidad de pago (PaymentMode).
export interface InterestCalculator {
  calculate(amount: Decimal, product: FinancialProduct, termDays: number): SimulationResult;
}
