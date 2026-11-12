import { Router } from "express";
import { validateBilling } from "./BillingValidation";
import type { CheckoutController } from "./CheckoutController";

export { validateBilling } from "./BillingValidation";

export function createCheckoutRouter(controller: Pick<CheckoutController, "processPayment">): Router {
  const router = Router();
  router.get("/config", (_req, res) => {
    res.json({
      environment: "DEMO",
      provider: "LOCAL_MOCK",
      simulation: true,
      cardCaptureAvailable: true,
      processingAvailable: true,
      realPaymentsAvailable: false,
      membershipActivationAvailable: true,
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
  // US33: el pago exige sesión y activa el Plan Pro; el controlador traduce HTTP.
  router.post("/simulate", controller.processPayment);
  return router;
}
