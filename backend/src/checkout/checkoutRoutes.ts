import { Router } from "express";
import { validateBilling } from "./BillingValidation";
import { InvalidMockPaymentError, MockPaymentService } from "./MockPaymentService";

export { validateBilling } from "./BillingValidation";

export function createCheckoutRouter(service: Pick<MockPaymentService, "simulate"> = new MockPaymentService()): Router {
  const router = Router();
  router.get("/config", (_req, res) => {
    res.json({
      environment: "DEMO",
      provider: "LOCAL_MOCK",
      simulation: true,
      cardCaptureAvailable: true,
      processingAvailable: true,
      realPaymentsAvailable: false,
      membershipActivationAvailable: false,
    });
  });
  router.post("/validate-billing", (req, res) => {
    const errors = validateBilling(req.body);
    if (Object.keys(errors).length) {
      res.status(400).json({ code: "INVALID_BILLING", message: "Revisa los datos de facturación.", errors });
      return;
    }
    // La validación no persiste ni devuelve datos personales. La continuación es académica.
    res.json({
      status: "BILLING_VALIDATED",
      environment: "DEMO",
      simulation: true,
      handoff: { planId: "PRO", paymentMethodToken: null },
    });
  });
  router.post("/simulate", (req, res) => {
    try {
      res.json(service.simulate(req.body));
    } catch (error) {
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
  });
  return router;
}
