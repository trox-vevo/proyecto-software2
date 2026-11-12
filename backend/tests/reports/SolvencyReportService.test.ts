import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { FixedDepositSimulationService } from "../../src/simulation/application/FixedDepositSimulationService";
import { InvalidSimulationParametersError } from "../../src/simulation/application/InvalidSimulationParametersError";
import { FinancialProduct } from "../../src/simulation/domain/FinancialProduct";
import { PaymentMode } from "../../src/simulation/domain/PaymentMode";
import { ServiceChannels } from "../../src/simulation/domain/ServiceChannels";
import { SimulationResult } from "../../src/simulation/domain/SimulationResult";
import type { SolvencyReport } from "../../src/reports/domain/SolvencyReport";
import { SolvencyReportService } from "../../src/reports/application/SolvencyReportService";
import { PdfKitGenerator } from "../../src/reports/infrastructure/PdfKitGenerator";

// US30 (TS-93, TS-94): datos propios, sin depender del catálogo de demostración.
const NOW = new Date("2026-11-11T15:00:00.000Z");
const channels = new ServiceChannels(true, true);
const products = [
  new FinancialProduct(1, "Caja Ñandú", new Decimal("0.05"), new Decimal("500"), channels),
  new FinancialProduct(2, "Banco Ejemplo", new Decimal("0.06"), new Decimal("500"), channels),
];
const simulationService = () => new FixedDepositSimulationService({ findFixedDepositsByDepartment: async () => products });
const fakeGenerator = () => ({ generate: vi.fn(async () => Buffer.from("%PDF-falso")) });
const isPdf = (pdf: Buffer) => {
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
};

describe("US30, SolvencyReportService", () => {
  it("vuelve a simular con los mismos parámetros y entrega el reporte al generador", async () => {
    const simulation = simulationService();
    const simulate = vi.spyOn(simulation, "simulate");
    const generator = fakeGenerator();
    const amount = new Decimal("1000");
    const pdf = await new SolvencyReportService(simulation, generator, () => NOW)
      .generateReport(amount, 360, "Lima", PaymentMode.AT_MATURITY);
    expect(pdf.toString()).toBe("%PDF-falso");
    expect(simulate).toHaveBeenCalledWith(amount, 360, "Lima", PaymentMode.AT_MATURITY);
    const report = generator.generate.mock.calls[0][0] as SolvencyReport;
    expect(report).toMatchObject({ amount, termDays: 360, department: "Lima", paymentMode: PaymentMode.AT_MATURITY, generatedAt: NOW });
    expect(report.results.map((result) => result.entityName)).toEqual(["Banco Ejemplo", "Caja Ñandú"]);
  });

  it("propaga un plazo no permitido sin generar el PDF", async () => {
    const generator = fakeGenerator();
    await expect(new SolvencyReportService(simulationService(), generator)
      .generateReport(new Decimal("1000"), 200, "Lima", PaymentMode.AT_MATURITY)).rejects.toThrow(InvalidSimulationParametersError);
    expect(generator.generate).not.toHaveBeenCalled();
  });
});

describe("US30, PdfKitGenerator (plantilla)", () => {
  const report = (results: SimulationResult[], paymentMode = PaymentMode.MONTHLY): SolvencyReport => ({
    amount: new Decimal("1000"), termDays: 360, department: "Lima", paymentMode, results, generatedAt: NOW,
  });

  it("genera un PDF válido con dos resultados (mensual y con calificación)", async () => {
    const results = await simulationService().simulate(new Decimal("1000"), 360, "Lima", PaymentMode.MONTHLY);
    results[0].riskRating = "A+";
    isPdf(await new PdfKitGenerator().generate(report(results)));
  });

  it("genera un PDF válido sin resultados y con calificación no disponible", async () => {
    isPdf(await new PdfKitGenerator().generate(report([], PaymentMode.AT_MATURITY)));
    const results = await simulationService().simulate(new Decimal("1000"), 180, "Lima", PaymentMode.AT_MATURITY);
    expect(results.every((result) => result.riskRating === null)).toBe(true);
    isPdf(await new PdfKitGenerator().generate(report(results, PaymentMode.AT_MATURITY)));
  });
});
