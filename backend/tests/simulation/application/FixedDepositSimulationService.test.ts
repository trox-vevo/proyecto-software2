import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { FixedDepositSimulationService } from "../../../src/simulation/application/FixedDepositSimulationService";
import { InvalidSimulationParametersError } from "../../../src/simulation/application/InvalidSimulationParametersError";
import { FinancialProduct } from "../../../src/simulation/domain/FinancialProduct";
import { FinancialProductRepository } from "../../../src/simulation/domain/FinancialProductRepository";
import { PaymentMode } from "../../../src/simulation/domain/PaymentMode";

const product = (id: number, tea: string, minimumAmount = "500") =>
  new FinancialProduct(id, `Entidad ${id}`, new Decimal(tea), new Decimal(minimumAmount));

// Repositorio falso: devuelve los productos solo para el departamento indicado
const repositoryWith = (department: string, products: FinancialProduct[]): FinancialProductRepository => ({
  findFixedDepositsByDepartment: async (requested) => (requested === department ? products : []),
});

// US10 · Flujo del servicio: validaciones, filtro por monto mínimo (US13), orden y elección
// de estrategia. Usa un repositorio falso, así que no depende de datos ni de base de datos.
describe("FixedDepositSimulationService", () => {
  const service = new FixedDepositSimulationService(repositoryWith("Lima", [product(1, "0.05")]));

  describe("validación de parámetros", () => {
    it.each([200, 0, 179, 1081])("rechaza el plazo no permitido %i", async (termDays) => {
      await expect(
        service.simulate(new Decimal("1000"), termDays, "Lima", PaymentMode.AT_MATURITY),
      ).rejects.toThrow(InvalidSimulationParametersError);
    });

    it.each([180, 360, 540, 720, 900, 1080])("acepta el plazo permitido %i", async (termDays) => {
      await expect(
        service.simulate(new Decimal("1000"), termDays, "Lima", PaymentMode.AT_MATURITY),
      ).resolves.toHaveLength(1);
    });

    it("rechaza un monto menor a S/ 500.00", async () => {
      await expect(
        service.simulate(new Decimal("499.99"), 360, "Lima", PaymentMode.AT_MATURITY),
      ).rejects.toThrow(InvalidSimulationParametersError);
    });

    it("acepta exactamente S/ 500.00", async () => {
      await expect(
        service.simulate(new Decimal("500"), 360, "Lima", PaymentMode.AT_MATURITY),
      ).resolves.toHaveLength(1);
    });
  });

  it("devuelve [] si no hay productos en el departamento", async () => {
    const results = await service.simulate(new Decimal("1000"), 360, "Cusco", PaymentMode.AT_MATURITY);

    expect(results).toEqual([]);
  });

  it("descarta los productos cuyo monto mínimo es mayor al monto ingresado (US13)", async () => {
    const service = new FixedDepositSimulationService(
      repositoryWith("Lima", [product(1, "0.05", "1000"), product(2, "0.05", "1000.01")]),
    );

    const results = await service.simulate(new Decimal("1000"), 360, "Lima", PaymentMode.AT_MATURITY);

    expect(results.map((r) => r.productId)).toEqual([1]);
  });

  it("ordena los resultados de mayor a menor totalInterest", async () => {
    const service = new FixedDepositSimulationService(
      repositoryWith("Lima", [product(1, "0.04"), product(2, "0.06"), product(3, "0.05")]),
    );

    const results = await service.simulate(new Decimal("1000"), 360, "Lima", PaymentMode.AT_MATURITY);

    expect(results.map((r) => r.productId)).toEqual([2, 3, 1]);
    expect(results.map((r) => r.totalInterest.toString())).toEqual(["60", "50", "40"]);
  });

  it("usa AtMaturityCalculator en AT_MATURITY", async () => {
    const [result] = await service.simulate(new Decimal("1000"), 360, "Lima", PaymentMode.AT_MATURITY);

    expect(result.totalInterest.toString()).toBe("50");
    expect(result.monthlyInterest).toBeNull();
  });

  it("usa MonthlyPaymentCalculator en MONTHLY", async () => {
    const [result] = await service.simulate(new Decimal("1000"), 360, "Lima", PaymentMode.MONTHLY);

    expect(result.totalInterest.toString()).toBe("48.89");
    expect(result.monthlyInterest?.toString()).toBe("4.07");
  });
});
