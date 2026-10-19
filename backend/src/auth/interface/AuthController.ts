import type { Request, Response, NextFunction } from "express";
import { AuthService, InvalidCredentialsError } from "../application/AuthService";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password }: Record<string, unknown> = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ message: "Email y contraseña son obligatorios" });
        return;
      }

      const session = await this.authService.login(email, password);
      res.json({ session });
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({ message: "Credenciales inválidas" });
        return;
      }
      next(error);
    }
  };
}
