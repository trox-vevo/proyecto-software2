import { Router } from "express";
import type { AuthController } from "./AuthController";

export function createAuthRouter(controller: AuthController) {
  const router = Router();
  router.post("/login", controller.login);
  return router;
}
