import Decimal from "decimal.js";
import { Request, Response } from "express";
import { FixedDepositSimulationService } from "../application/FixedDepositSimulationService";
import { InvalidSimulationParametersError } from "../application/InvalidSimulationParametersError";
import { PaymentMode } from "../domain/PaymentMode";
import { SimulationResult } from "../domain/SimulationResult";

// Monto en soles como string: no negativo y con máximo 2 decimales
const AMOUNT_FORMAT = /^\d+(\.\d{1,2})?$/;

const isPaymentMode = (value: unknown): value is PaymentMode =>
  Object.values(PaymentMode).includes(value as PaymentMode);

// Los Decimal viajan como string para no perder precisión ni los ceros finales
const toResponse = (result: SimulationResult) => ({
  productId: result.productId,
  entityName: result.entityName,
  tea: result.tea.toString(),
  totalInterest: result.totalInterest.toFixed(2),
  monthlyInterest: result.monthlyInterest?.toFixed(2) ?? null,
  // US18. Sin monthlyMaintenanceFee: US17 no aplica a plazo fijo
  channels: {
    hasPhysicalBranches: result.channels.hasPhysicalBranches,
    hasAtms: result.channels.hasAtms,
  },
});

// Traduce HTTP ↔ servicio para POST /api/simulations/fixed-deposits, sin lógica de negocio.
// Revisa los tipos del body (400 si no cuadran), llama al servicio y devuelve los resultados
// como JSON. Las reglas del negocio (plazo, monto mínimo) las valida el servicio.
export class SimulationController {
  constructor(private readonly simulationService: FixedDepositSimulationService) {}

  // Arrow function: conserva `this` al pasarse como handler de Express
  simulateFixedDeposit = async (req: Request, res: Response): Promise<void> => {
    const { amount, termDays, department, paymentMode }: Record<string, unknown> =
      req.body ?? {};

    if (
      typeof amount !== "string" ||
      !AMOUNT_FORMAT.test(amount) ||
      typeof termDays !== "number" ||
      typeof department !== "string" ||
      !isPaymentMode(paymentMode)
    ) {
      res.status(400).json({
        message:
          "Datos de simulación inválidos: revisa el monto, el plazo, el departamento y la modalidad de pago.",
      });
      return;
    }

    try {
      const results = await this.simulationService.simulate(
        new Decimal(amount),
        termDays,
        department,
        paymentMode,
      );
      res.json(results.map(toResponse));
    } catch (error) {
      if (error instanceof InvalidSimulationParametersError) {
        res.status(400).json({ message: error.message });
        return;
      }
      throw error; // lo atiende el manejador global de app.ts (HTTP 500)
    }
  };
}
