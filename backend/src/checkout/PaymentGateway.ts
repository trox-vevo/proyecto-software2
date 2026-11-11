// US33: la pasarela de pagos vista desde el procesamiento. Hoy la implementa MockPaymentService (US32);
// una pasarela real sería otra clase que cumpla esta interfaz.
export interface PaymentResult {
  reference: string;
  outcome: "APPROVED" | "DECLINED";
  declineReason: string | null;
  message: string;
  occurredAt: string;
}

export interface PaymentGateway {
  simulate(paymentRequest: unknown): PaymentResult;
}
