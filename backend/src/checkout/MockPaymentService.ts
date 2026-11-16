import { randomBytes } from "node:crypto";
import { validateBilling, type BillingErrors } from "./BillingValidation";
import type { PaymentGateway } from "./PaymentGateway";
import { PRO_MONTHLY_PRICE } from "../plans/Plan";

export type DemoScenarioId = "DEMO_APPROVED" | "DEMO_DECLINED";

export interface MockPaymentResult {
  reference: string;
  outcome: "APPROVED" | "DECLINED";
  simulation: true;
  environment: "DEMO";
  occurredAt: string;
  planId: "PRO";
  amount: string;
  message: string;
  declineReason: null | "Fondos ficticios insuficientes.";
}

export class InvalidMockPaymentError extends Error {
  constructor(readonly errors: BillingErrors = {}) {
    super("Revisa los datos de la simulación y utiliza un escenario de demostración permitido.");
    this.name = "InvalidMockPaymentError";
  }
}

function readScenario(input: unknown): DemoScenarioId {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new InvalidMockPaymentError();
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["planId", "scenarioId", "billing"].includes(key)) ||
      !["DEMO_APPROVED", "DEMO_DECLINED"].includes(body.scenarioId as string)) {
    throw new InvalidMockPaymentError();
  }
  const errors = validateBilling({ planId: body.planId, billing: body.billing });
  if (Object.keys(errors).length) throw new InvalidMockPaymentError(errors);
  return body.scenarioId as DemoScenarioId;
}

/** Pasarela académica sin persistencia, credenciales ni conexiones externas. */
export class MockPaymentService implements PaymentGateway {
  simulate(input: unknown): MockPaymentResult {
    const scenario = readScenario(input);
    const approved = scenario === "DEMO_APPROVED";
    return {
      // Etiqueta opaca de demostración. No es una PK ni identifica una cuenta real.
      reference: `DEMO-${randomBytes(12).toString("hex")}`,
      outcome: approved ? "APPROVED" : "DECLINED",
      simulation: true,
      environment: "DEMO",
      occurredAt: new Date().toISOString(),
      planId: "PRO",
      // US31: el monto lo decide el servidor; nunca se lee de la petición.
      amount: PRO_MONTHLY_PRICE,
      message: approved
        ? `Pago de demostración aprobado por S/ ${PRO_MONTHLY_PRICE}. No se realizó ningún cobro real.`
        : "Pago de demostración rechazado. No se realizó ningún cobro.",
      declineReason: approved ? null : "Fondos ficticios insuficientes.",
    };
  }
}
