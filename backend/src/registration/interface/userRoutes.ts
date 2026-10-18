import { Router } from "express";
import type { UserController } from "./UserController";

export function createUserRouter(controller: UserController): Router {
  const router = Router();
  router.get("/check-email", controller.checkEmail);
  router.post("/register", controller.register);
  return router;
}
