import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../jwtSecret";

declare module "express-serve-static-core" {
  interface Request {
    userId?: number;
  }
}

export function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(match[1], getJwtSecret());
    if (typeof payload === "object" && typeof payload.sub === "string") {
      const userId = Number(payload.sub);
      if (Number.isSafeInteger(userId) && userId > 0 && String(userId) === payload.sub) {
        req.userId = userId;
      }
    }
    next();
  } catch (error: unknown) {
    if (error instanceof jwt.JsonWebTokenError) {
      next();
      return;
    }
    next(error);
  }
}
