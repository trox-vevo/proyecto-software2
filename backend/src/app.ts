import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { ahorrosRouter } from "./routes/ahorros";
import { FixedDepositSimulationService } from "./simulation/application/FixedDepositSimulationService";
import type { FinancialProductRepository } from "./simulation/domain/FinancialProductRepository";
import { SimulationController } from "./simulation/interface/SimulationController";
import { RegistrationService } from "./registration/application/RegistrationService";
import type { UserRepository } from "./registration/domain/UserRepository";
import { UserController } from "./registration/interface/UserController";
import { createUserRouter } from "./registration/interface/userRoutes";
import { AuthService } from "./auth/application/AuthService";
import { AuthController } from "./auth/interface/AuthController";
import { createAuthRouter } from "./auth/interface/authRoutes";

export function createApp(
  productRepository: FinancialProductRepository,
  userRepository?: UserRepository,
) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/ahorros", ahorrosRouter);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const simulationController = new SimulationController(
    new FixedDepositSimulationService(productRepository),
  );
  app.post(
    "/api/simulations/fixed-deposits",
    simulationController.simulateFixedDeposit,
  );

  if (userRepository) {
    app.use(
      "/api/users",
      createUserRouter(new UserController(new RegistrationService(userRepository))),
    );
    app.use(
      "/api/auth",
      createAuthRouter(new AuthController(new AuthService(userRepository))),
    );
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({
        message: "El cuerpo de la petición no es un JSON válido.",
      });
      return;
    }

    console.error(error);
    res.status(500).json({
      message: "Ocurrió un error inesperado. Inténtalo más tarde.",
    });
  });

  return app;
}
