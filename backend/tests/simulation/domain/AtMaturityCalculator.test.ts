import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { AtMaturityCalculator } from "../../../src/simulation/domain/AtMaturityCalculator";
import { FinancialProduct } from "../../../src/simulation/domain/FinancialProduct";

const productWithTea = (tea: string) =>
  new FinancialProduct(1, "Banco de Prueba", new Decimal(tea), new Decimal("500"));

// US10 · Escenario 1 — Pago al final del periodo.
// Valores esperados: tabla "Casos de prueba" de CLAUDE.md §6.
describe("AtMaturityCalculator", () => {
  const calculator = new AtMaturityCalculator();

  it.each([
    { amount: "1000", tea: "0.05", termDays: 180, expected: "24.70" },
    { amount: "1000", tea: "0.05", termDays: 360, expected: "50.00" },
    { amount: "1000", tea: "0.05", termDays: 720, expected: "102.50" },
    // Caso límite: 157.625 exacto → ROUND_HALF_UP debe dar 157.63
    { amount: "1000", tea: "0.05", termDays: 1080, expected: "157.63" },
    { amount: "500", tea: "0.035", termDays: 540, expected: "26.48" },
    // TEA = 0 → sin interés
    { amount: "1000", tea: "0", termDays: 360, expected: "0.00" },
  ])(
    "monto $amount, TEA $tea, $termDays días → totalInterest $expected",
    ({ amount, tea, termDays, expected }) => {
      const result = calculator.calculate(new Decimal(amount), productWithTea(tea), termDays);

      // toString compara el valor exacto: falla si no se redondeó a 2 decimales
      expect(result.totalInterest.toString()).toBe(new Decimal(expected).toString());
    },
  );

  it("devuelve monthlyInterest como null (no aplica al pago al final)", () => {
    const result = calculator.calculate(new Decimal("1000"), productWithTea("0.05"), 180);

    expect(result.monthlyInterest).toBeNull();
  });

  it("copia id, entidad y TEA del producto al resultado", () => {
    const product = new FinancialProduct(7, "Caja Arequipa", new Decimal("0.05"), new Decimal("500"));

    const result = calculator.calculate(new Decimal("1000"), product, 180);

    expect(result.productId).toBe(7);
    expect(result.entityName).toBe("Caja Arequipa");
    expect(result.tea.equals("0.05")).toBe(true);
    expect(result.minimumAmount.equals("500")).toBe(true);
  });
});
