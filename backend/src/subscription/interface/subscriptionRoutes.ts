import { Router } from "express";
import type { SubscriptionController } from "./SubscriptionController";

export function createSubscriptionRouter(
  controller: Pick<
    SubscriptionController,
    "cancelSubscription" | "getHistory" | "renewalPaymentFailed"
  >,
): Router {
  const router = Router();
  router.get("/history", controller.getHistory);
  router.post("/cancel", controller.cancelSubscription);
  router.post("/renewal-payment-failure", controller.renewalPaymentFailed);
  return router;
}
