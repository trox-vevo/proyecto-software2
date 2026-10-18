import type { Request, Response, NextFunction } from "express";
import { RegistrationService, InvalidRegistrationError } from "../application/RegistrationService";
import { DuplicateEmailError } from "../domain/UserRepository";

export class UserController {
  constructor(private readonly registrationService: RegistrationService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.registrationService.register(req.body ?? {});
      res.status(201).json({ message: "Cuenta creada correctamente", user });
    } catch (error: unknown) {
      if (error instanceof InvalidRegistrationError) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof DuplicateEmailError) {
        res.status(409).json({ message: error.message });
      } else {
        next(error);
      }
    }
  };

  checkEmail = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const available = this.registrationService.isEmailAvailable(req.query.email);
      res.status(200).json({ available });
    } catch (error: unknown) {
      if (error instanceof InvalidRegistrationError) {
        res.status(400).json({ message: error.message });
      } else {
        next(error);
      }
    }
  };
}
