import type { NextFunction, Request, Response } from "express";
import type { ProAccessService } from "../application/ProAccessService";

// US27 (TS-85): solo traduce HTTP. req.userId lo deja optionalAuthMiddleware (US03).
export class ProAccessMiddleware {
  constructor(private readonly proAccessService: ProAccessService) {}

  handle = (req: Request, res: Response, next: NextFunction): void => {
    if (req.userId === undefined) {
      res.status(401).json({ message: "Inicia sesión para continuar." });
      return;
    }
    if (!this.proAccessService.hasProAccess(req.userId)) {
      res.status(403).json({ message: "Exclusivo Plan Pro" });
      return;
    }
    next();
  };
}
