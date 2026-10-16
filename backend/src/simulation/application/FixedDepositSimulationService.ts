import Decimal from "decimal.js";
import { AtMaturityCalculator } from "../domain/AtMaturityCalculator";
import { FinancialProductRepository } from "../domain/FinancialProductRepository";
import { InterestCalculator } from "../domain/InterestCalculator";
import { MonthlyPaymentCalculator } from "../domain/MonthlyPaymentCalculator";
import { PaymentMode } from "../domain/PaymentMode";
import { SimulationResult } from "../domain/SimulationResult";
import { InvalidSimulationParametersError } from "./InvalidSimulationParametersError";

const ALLOWED_TERM_DAYS = [180, 360, 540, 720, 900, 1080];
const MINIMUM_OPENING_AMOUNT = new Decimal("500");

// Caso de uso de US10: simula un depósito a plazo fijo en todas las entidades del departamento.
// Flujo: valida plazo y monto → busca productos → descarta los de monto mínimo mayor →
// calcula con la estrategia de la modalidad → ordena de mayor a menor ganancia.
export class FixedDepositSimulationService {
  // Strategy: una calculadora por modalidad. Record obliga a cubrir cada valor de PaymentMode.
  private readonly calculators: Record<PaymentMode, InterestCalculator> = {
    [PaymentMode.AT_MATURITY]: new AtMaturityCalculator(),
    [PaymentMode.MONTHLY]: new MonthlyPaymentCalculator(),
  };

  constructor(private readonly repository: FinancialProductRepository) {}

  async simulate(
    amount: Decimal,
    termDays: number,
    department: string,
    paymentMode: PaymentMode,
  ): Promise<SimulationResult[]> {
    if (!this.validateTerm(termDays)) {
      throw new InvalidSimulationParametersError(
        "El plazo debe ser de 180, 360, 540, 720, 900 o 1080 días.",
      );
    }
    if (!this.validateAmount(amount)) {
      throw new InvalidSimulationParametersError(
        "El monto mínimo de apertura es S/ 500.00.",
      );
    }

    const products = (
      await this.repository.findFixedDepositsByDepartment(department)
    ).filter((product) => product.minimumAmount.lte(amount));
    const calculator = this.getCalculator(paymentMode);

    return this.sortByTotalInterest(
      products.map((product) =>
        calculator.calculate(amount, product, termDays),
      ),
    );
  }

  private validateTerm(termDays: number): boolean {
    return ALLOWED_TERM_DAYS.includes(termDays);
  }

  private validateAmount(amount: Decimal): boolean {
    return amount.gte(MINIMUM_OPENING_AMOUNT);
  }

  private getCalculator(paymentMode: PaymentMode): InterestCalculator {
    return this.calculators[paymentMode];
  }

  private sortByTotalInterest(results: SimulationResult[]): SimulationResult[] {
    return results.sort((a, b) =>
      b.totalInterest.comparedTo(a.totalInterest),
    );
  }
}
