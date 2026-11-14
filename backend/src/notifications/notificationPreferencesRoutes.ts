import { Router } from "express";
import type { NotificationPreferencesController } from "./NotificationPreferencesController";

export function createNotificationPreferencesRouter(
  controller: NotificationPreferencesController,
): Router {
  const router = Router();
  router.get("/preferences", controller.get);
  router.put("/preferences", controller.update);
  return router;
}
