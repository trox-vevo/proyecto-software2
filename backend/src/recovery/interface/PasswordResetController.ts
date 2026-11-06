import type { NextFunction, Request, Response } from "express";
import {
  InvalidNewPasswordError,
  InvalidRecoveryTokenError,
  PasswordResetService,
} from "../application/PasswordResetService";

export class PasswordResetController {
  constructor(private readonly service: PasswordResetService) {}

  reset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { token, newPassword }: Record<string, unknown> = req.body ?? {};
    if (typeof token !== "string" || !token || typeof newPassword !== "string") {
      res.status(400).json({ message: "El token y la nueva contraseña son obligatorios." });
      return;
    }

    try {
      await this.service.resetPassword(token, newPassword);
      res.status(200).json({ message: "Contraseña actualizada correctamente." });
    } catch (error: unknown) {
      if (error instanceof InvalidRecoveryTokenError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof InvalidNewPasswordError) {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  };
}
