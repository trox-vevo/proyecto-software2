import type { NextFunction, Request, Response } from "express";
import {
  PasswordRecoveryService,
  RecoveryEmailDeliveryError,
} from "../application/PasswordRecoveryService";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESPONSE_MESSAGE = "Si el correo existe, recibirás un enlace de recuperación.";

export class PasswordRecoveryController {
  constructor(private readonly service: PasswordRecoveryService) {}

  request = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { email }: Record<string, unknown> = req.body ?? {};
    if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim()) || email.trim().length > 254) {
      res.status(400).json({ message: "Ingresa un correo electrónico válido." });
      return;
    }

    try {
      await this.service.requestRecovery(email);
      res.status(202).json({ message: RESPONSE_MESSAGE });
    } catch (error: unknown) {
      if (error instanceof RecoveryEmailDeliveryError) {
        console.error("No se pudo entregar un correo de recuperación.", error.cause);
        res.status(202).json({ message: RESPONSE_MESSAGE });
        return;
      }
      next(error);
    }
  };
}
