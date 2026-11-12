import Decimal from "decimal.js";
import type { Request, Response } from "express";
import { InvalidSimulationParametersError } from "../../simulation/application/InvalidSimulationParametersError";
import { PaymentMode } from "../../simulation/domain/PaymentMode";
import { AMOUNT_FORMAT } from "../../simulation/interface/SimulationController";
import type { SolvencyReportService } from "../application/SolvencyReportService";

// US30 (TS-94): solo traduce HTTP ↔ SolvencyReportService y dispara la descarga nativa.
export class ReportController {
  constructor(private readonly solvencyReportService: Pick<SolvencyReportService, "generateReport">) {}

  downloadSolvencyReport = async (req: Request, res: Response): Promise<void> => {
    const { amount, termDays, department, paymentMode }: Record<string, unknown> = req.body ?? {};
    // Mismo criterio que SimulationController (US10): tipos y formato del monto.
    if (
      typeof amount !== "string" || !AMOUNT_FORMAT.test(amount) ||
      typeof termDays !== "number" ||
      typeof department !== "string" ||
      !Object.values(PaymentMode).includes(paymentMode as PaymentMode)
    ) {
      res.status(400).json({
        message: "Datos de simulación inválidos: revisa el monto, el plazo, el departamento y la modalidad de pago.",
      });
      return;
    }
    try {
      const pdf = await this.solvencyReportService.generateReport(
        new Decimal(amount), termDays, department, paymentMode as PaymentMode,
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="ReporteSolvencia.pdf"');
      res.send(pdf);
    } catch (error) {
      if (error instanceof InvalidSimulationParametersError) {
        res.status(400).json({ message: error.message });
        return;
      }
      throw error; // lo atiende el manejador global de app.ts (500 con mensaje amigable)
    }
  };
}
