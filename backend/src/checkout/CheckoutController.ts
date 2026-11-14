import type { Request, Response } from "express";
import {
  AuthenticationRequiredError as HistoryAuthenticationRequiredError,
  CheckoutHistoryUnavailableError,
  CheckoutReceiptNotFoundError,
} from "./CheckoutPaymentHistory";
import type { CheckoutHistoryService } from "./CheckoutHistoryService";
import { InvalidMockPaymentError } from "./MockPaymentService";
import { AuthenticationRequiredError, type PaymentProcessingService } from "./PaymentProcessingService";
import type { PaymentReceiptGenerator } from "./PaymentReceiptGenerator";

// US33: solo traduce HTTP ↔ PaymentProcessingService. Conserva las respuestas 400/503 de la US32.
export class CheckoutController {
  constructor(
    private readonly paymentProcessingService: Pick<PaymentProcessingService, "processPayment">,
    private readonly historyService?: Pick<CheckoutHistoryService, "getHistory" | "getReceipt">,
    private readonly receiptGenerator?: Pick<PaymentReceiptGenerator, "generate">,
  ) {}

  processPayment = (req: Request, res: Response): void => {
    try {
      res.json(this.paymentProcessingService.processPayment(req.userId, req.body));
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        res.status(401).json({ code: "AUTHENTICATION_REQUIRED", message: error.message });
        return;
      }
      if (error instanceof CheckoutHistoryUnavailableError) {
        res.status(503).json({ code: "CHECKOUT_HISTORY_UNAVAILABLE", message: error.message });
        return;
      }
      if (error instanceof InvalidMockPaymentError) {
        res.status(400).json({
          code: "INVALID_DEMO_PAYMENT", message: error.message, errors: error.errors,
          simulation: true, environment: "DEMO",
        });
        return;
      }
      // No registrar excepciones que pudieran contener cuerpos de solicitudes.
      res.status(503).json({
        code: "DEMO_PAYMENT_UNAVAILABLE", message: "No se pudo procesar la simulación. Inténtalo nuevamente.",
        simulation: true, environment: "DEMO",
      });
    }
  };

  getHistory = (req: Request, res: Response): void => {
    try {
      if (!this.historyService) throw new CheckoutHistoryUnavailableError();
      res.json({ transactions: this.historyService.getHistory(req.userId) });
    } catch (error) {
      if (error instanceof HistoryAuthenticationRequiredError) {
        res.status(401).json({ code: "AUTHENTICATION_REQUIRED", message: error.message });
        return;
      }
      if (error instanceof CheckoutHistoryUnavailableError) {
        res.status(503).json({ code: "CHECKOUT_HISTORY_UNAVAILABLE", message: error.message });
        return;
      }
      throw error;
    }
  };

  downloadReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.historyService || !this.receiptGenerator) throw new CheckoutHistoryUnavailableError();
      const reference = req.params.reference;
      if (typeof reference !== "string") throw new CheckoutReceiptNotFoundError();
      const payment = this.historyService.getReceipt(req.userId, reference);
      const pdf = await this.receiptGenerator.generate(payment);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Comprobante-${payment.reference}.pdf"`);
      res.send(pdf);
    } catch (error) {
      if (error instanceof HistoryAuthenticationRequiredError) {
        res.status(401).json({ code: "AUTHENTICATION_REQUIRED", message: error.message });
        return;
      }
      if (error instanceof CheckoutHistoryUnavailableError) {
        res.status(503).json({ code: "CHECKOUT_HISTORY_UNAVAILABLE", message: error.message });
        return;
      }
      if (error instanceof CheckoutReceiptNotFoundError) {
        res.status(404).json({ code: "CHECKOUT_RECEIPT_NOT_FOUND", message: error.message });
        return;
      }
      throw error;
    }
  };
}
