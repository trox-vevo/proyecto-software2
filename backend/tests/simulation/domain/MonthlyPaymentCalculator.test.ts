import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { MonthlyPaymentCalculator } from "../../../src/simulation/domain/MonthlyPaymentCalculator";
import { FinancialProduct } from "../../../src/simulation/domain/FinancialProduct";

const productWithTea = (tea: string) =>
  new FinancialProduct(1, "Banco de Prueba", new Decimal(tea), new Decimal("500"));

// US10 · Escenario 2 — Pago de intereses mensuales (sin capitalizar).
// Valores esperados: tabla "Casos de prueba" de CLAUDE.md §6.
describe("MonthlyPaymentCalculator", () => {
  const calculator = new MonthlyPaymentCalculator();

  it.each([
    { amount: "1000", tea: "0.05", termDays: 180, total: "24.44", monthly: "4.07" },
    // 360 y 1080 detectan si se redondea monthlyInterest antes de tiempo:
    // 4.07 × 12 = 48.84 y 4.07 × 36 = 146.52 serían incorrectos
    { amount: "1000", tea: "0.05", termDays: 360, total: "48.89", monthly: "4.07" },
    { amount: "1000", tea: "0.05", termDays: 1080, total: "146.67", monthly: "4.07" },
    { amount: "500", tea: "0.035", termDays: 540, total: "25.84", monthly: "1.44" },
    // TEA = 0 → sin interés
    { amount: "1000", tea: "0", termDays: 360, total: "0.00", monthly: "0.00" },
  ])(
    "monto $amount, TEA $tea, $termDays días → totalInterest $total, monthlyInterest $monthly",
    ({ amount, tea, termDays, total, monthly }) => {
      const result = calculator.calculate(new Decimal(amount), productWithTea(tea), termDays);

      // toString compara el valor exacto: falla si no se redondeó a 2 decimales
      expect(result.totalInterest.toString()).toBe(new Decimal(total).toString());
      expect(result.monthlyInterest?.toString()).toBe(new Decimal(monthly).toString());
    },
  );

  it("copia id, entidad y TEA del producto al resultado", () => {
    const product = new FinancialProduct(7, "Caja Arequipa", new Decimal("0.05"), new Decimal("500"));

    const result = calculator.calculate(new Decimal("1000"), product, 180);

    expect(result.productId).toBe(7);
    expect(result.entityName).toBe("Caja Arequipa");
    expect(result.tea.equals("0.05")).toBe(true);
  });
});
