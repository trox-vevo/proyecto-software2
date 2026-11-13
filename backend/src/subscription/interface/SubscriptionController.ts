import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import {
  AuthenticationRequiredError,
  RenewalPaymentFailureNotApplicableError,
  SubscriptionNotActiveError,
  SubscriptionHistoryUnavailableError,
  type SubscriptionService,
} from "../application/SubscriptionService";

export class SubscriptionController {
  constructor(
    private readonly subscriptionService: Pick<
      SubscriptionService,
      "cancelSubscription" | "getStatus" | "recordRenewalPaymentFailure"
    >,
    private readonly paymentWebhookSecret?: string,
  ) {}

  cancelSubscription = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.subscriptionService.cancelSubscription(req.userId));
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        res.status(401).json({ code: "AUTHENTICATION_REQUIRED", message: error.message });
        return;
      }
      if (error instanceof SubscriptionNotActiveError) {
        res.status(409).json({ code: "SUBSCRIPTION_NOT_ACTIVE", message: error.message });
        return;
      }
      next(error);
    }
  };

  getHistory = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.json(this.subscriptionService.getStatus(req.userId));
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        res.status(401).json({ code: "AUTHENTICATION_REQUIRED", message: error.message });
        return;
      }
      if (error instanceof SubscriptionHistoryUnavailableError) {
        res.status(503).json({ code: "SUBSCRIPTION_HISTORY_UNAVAILABLE", message: error.message });
        return;
      }
      next(error);
    }
  };

  renewalPaymentFailed = (req: Request, res: Response, next: NextFunction): void => {
    if (!this.paymentWebhookSecret) {
      res.status(503).json({ code: "PAYMENT_WEBHOOK_NOT_CONFIGURED", message: "El webhook de pagos no está configurado." });
      return;
    }
    const suppliedSecret = req.get("x-subscription-webhook-secret") ?? "";
    const suppliedBuffer = Buffer.from(suppliedSecret);
    const expectedBuffer = Buffer.from(this.paymentWebhookSecret);
    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      res.status(401).json({ code: "INVALID_WEBHOOK_SECRET", message: "El evento de pago no está autorizado." });
      return;
    }

    try {
      const event = req.body as Record<string, unknown> | null;
      if (
        typeof event !== "object" ||
        event === null ||
        typeof event.eventId !== "string" ||
        typeof event.userId !== "number" ||
        typeof event.periodExpiresAt !== "string" ||
        typeof event.occurredAt !== "string"
      ) {
        res.status(400).json({ code: "INVALID_PAYMENT_EVENT", message: "El evento de fallo de pago no es válido." });
        return;
      }
      const status = this.subscriptionService.recordRenewalPaymentFailure({
        eventId: event.eventId,
        userId: event.userId,
        periodExpiresAt: event.periodExpiresAt,
        occurredAt: event.occurredAt,
      });
      res.json({ status });
    } catch (error) {
      if (error instanceof RenewalPaymentFailureNotApplicableError) {
        res.status(409).json({ code: "SUBSCRIPTION_NOT_ACTIVE", message: error.message });
        return;
      }
      if (error instanceof SubscriptionHistoryUnavailableError) {
        res.status(503).json({ code: "SUBSCRIPTION_HISTORY_UNAVAILABLE", message: error.message });
        return;
      }
      if (error instanceof RangeError) {
        res.status(400).json({ code: "INVALID_PAYMENT_EVENT", message: error.message });
        return;
      }
      next(error);
    }
  };
}
