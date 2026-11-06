import Decimal from "decimal.js";
import { FinancialProduct } from "./FinancialProduct";
import { InterestCalculator } from "./InterestCalculator";
import { SimulationResult } from "./SimulationResult";

const DAYS_PER_YEAR = 360;
const DAYS_PER_MONTH = 30;

// Estrategia para PaymentMode.MONTHLY (US10, Escenario 2): el interés se paga cada 30 días.
// Sin capitalizar: TEM = (1 + TEA)^(30/360) − 1 · monthlyInterest = amount × TEM
// totalInterest = monthlyInterest × (days/30). Se redondea solo al final, ambos desde el valor sin redondear.
export class MonthlyPaymentCalculator implements InterestCalculator {
  calculate(
    amount: Decimal,
    product: FinancialProduct,
    termDays: number,
  ): SimulationResult {
    const tem = product.tea
      .plus(1)
      .pow(new Decimal(DAYS_PER_MONTH).div(DAYS_PER_YEAR))
      .minus(1);
    const monthlyInterest = amount.times(tem);
    const totalInterest = monthlyInterest.times(
      new Decimal(termDays).div(DAYS_PER_MONTH),
    );

    return new SimulationResult(
      product.id,
      product.entityName,
      product.tea,
      totalInterest.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      monthlyInterest.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      product.channels,
    );
  }
}
