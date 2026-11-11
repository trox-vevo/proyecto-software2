import type { Request, Response } from "express";
import { InvalidMockPaymentError } from "./MockPaymentService";
import { AuthenticationRequiredError, type PaymentProcessingService } from "./PaymentProcessingService";

// US33: solo traduce HTTP ↔ PaymentProcessingService. Conserva las respuestas 400/503 de la US32.
export class CheckoutController {
  constructor(private readonly paymentProcessingService: Pick<PaymentProcessingService, "processPayment">) {}

  processPayment = (req: Request, res: Response): void => {
    try {
      res.json(this.paymentProcessingService.processPayment(req.userId, req.body));
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        res.status(401).json({ code: "AUTHENTICATION_REQUIRED", message: error.message });
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
}
