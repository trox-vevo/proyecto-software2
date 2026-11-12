import type Decimal from "decimal.js";
import type { FixedDepositSimulationService } from "../../simulation/application/FixedDepositSimulationService";
import type { PaymentMode } from "../../simulation/domain/PaymentMode";
import type { PdfGenerator } from "./PdfGenerator";

// US30 (TS-94): arma el Reporte de Solvencia de un plazo fijo y lo compila a PDF.
export class SolvencyReportService {
  constructor(
    private readonly simulationService: Pick<FixedDepositSimulationService, "simulate">,
    private readonly pdfGenerator: PdfGenerator,
    private readonly now: () => Date = () => new Date(), // inyectable para las pruebas
  ) {}

  async generateReport(amount: Decimal, termDays: number, department: string, paymentMode: PaymentMode): Promise<Buffer> {
    // Vuelve a simular: el PDF nunca usa números enviados por el navegador.
    // Si los parámetros no son válidos, simulate lanza InvalidSimulationParametersError.
    // El usuario ya pasó por ProAccessMiddleware: es Pro, así que la calificación no se oculta.
    const results = await this.simulationService.simulate(amount, termDays, department, paymentMode);
    return this.pdfGenerator.generate({ amount, termDays, department, paymentMode, results, generatedAt: this.now() });
  }
}
