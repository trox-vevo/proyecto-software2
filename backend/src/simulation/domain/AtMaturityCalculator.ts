import Decimal from "decimal.js";
import { FinancialProduct } from "./FinancialProduct";
import { InterestCalculator } from "./InterestCalculator";
import { SimulationResult } from "./SimulationResult";

const DAYS_PER_YEAR = 360;

// Estrategia para PaymentMode.AT_MATURITY (US10, Escenario 1): el interés se capitaliza y se cobra al final.
// totalInterest = amount × ((1 + TEA)^(days/360) − 1), redondeado a 2 decimales solo al final.
export class AtMaturityCalculator implements InterestCalculator {
  calculate(
    amount: Decimal,
    product: FinancialProduct,
    termDays: number,
  ): SimulationResult {
    const growthFactor = product.tea
      .plus(1)
      .pow(new Decimal(termDays).div(DAYS_PER_YEAR));
    const totalInterest = amount
      .times(growthFactor.minus(1))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return new SimulationResult(
      product.id,
      product.entityName,
      product.tea,
      totalInterest,
      null,
    );
  }
}
