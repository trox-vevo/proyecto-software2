export interface CheckoutPayment {
  reference: string;
  outcome: "APPROVED" | "DECLINED";
  occurredAt: string;
  planId: "PRO";
  amount: string | null; // texto con 2 decimales; null en pagos anteriores al precio (US31)
  currency: "PEN";
  receiptStatus: "AVAILABLE" | "NOT_APPLICABLE";
}

export interface CheckoutPaymentHistoryRepository {
  recordCheckoutAttempt(userId: number, payment: CheckoutPayment): void;
  recordApprovedCheckout(userId: number, expiresAt: string, payment: CheckoutPayment): void;
  findCheckoutHistory(userId: number): CheckoutPayment[];
  findCheckoutReceipt(userId: number, reference: string): CheckoutPayment | null;
}

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Inicia sesión para consultar tu historial de facturación.");
    this.name = "AuthenticationRequiredError";
  }
}

export class CheckoutHistoryUnavailableError extends Error {
  constructor() {
    super("El historial de facturación no está disponible en este momento.");
    this.name = "CheckoutHistoryUnavailableError";
  }
}

export class CheckoutReceiptNotFoundError extends Error {
  constructor() {
    super("No se encontró el comprobante solicitado.");
    this.name = "CheckoutReceiptNotFoundError";
  }
}
