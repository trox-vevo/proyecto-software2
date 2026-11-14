import type { NextFunction, Request, Response } from "express";
import { InvalidNotificationPreferencesError } from "./NotificationPreferences";
import type { NotificationPreferencesService } from "./NotificationPreferencesService";

export class NotificationPreferencesController {
  constructor(private readonly service?: NotificationPreferencesService) {}

  get = (req: Request, res: Response, next: NextFunction): void => {
    if (this.service === undefined) {
      res.status(503).json({ message: "La configuración de notificaciones no está disponible." });
      return;
    }
    if (req.userId === undefined) {
      res.status(401).json({ message: "Inicia sesión para continuar." });
      return;
    }

    try {
      res.json(this.service.get(req.userId));
    } catch (error) {
      next(error);
    }
  };

  update = (req: Request, res: Response, next: NextFunction): void => {
    if (this.service === undefined) {
      res.status(503).json({ message: "La configuración de notificaciones no está disponible." });
      return;
    }
    if (req.userId === undefined) {
      res.status(401).json({ message: "Inicia sesión para continuar." });
      return;
    }

    try {
      res.json(this.service.save(req.userId, req.body));
    } catch (error) {
      if (error instanceof InvalidNotificationPreferencesError) {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  };
}
