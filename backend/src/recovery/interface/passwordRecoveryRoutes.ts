import { Router } from "express";
import type { PasswordRecoveryController } from "./PasswordRecoveryController";
import type { PasswordResetController } from "./PasswordResetController";

export function createPasswordRecoveryRouter(
  controller: PasswordRecoveryController,
  resetController: PasswordResetController,
): Router {
  const router = Router();
  router.post("/forgot-password", controller.request);
  router.post("/reset-password", resetController.reset);
  return router;
}
