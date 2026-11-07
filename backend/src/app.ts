import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { ahorrosRouter } from "./routes/ahorros";
import { FixedDepositSimulationService } from "./simulation/application/FixedDepositSimulationService";
import type { FinancialProductRepository } from "./simulation/domain/FinancialProductRepository";
import { SimulationController } from "./simulation/interface/SimulationController";
import { ServicioPerfiles } from "./profile/application/ServicioPerfiles";
import {
  CorreoDuplicadoError,
  DatosPerfilInvalidosError,
  PerfilNoEncontradoError,
} from "./profile/application/ErroresPerfil";
import { RepositorioPerfilesJson } from "./profile/infrastructure/RepositorioPerfilesJson";
import type { RepositorioPerfiles } from "./profile/domain/RepositorioPerfiles";
import { RegistrationService } from "./registration/application/RegistrationService";
import type { UserRepository } from "./registration/domain/UserRepository";
import { UserController } from "./registration/interface/UserController";
import { createUserRouter } from "./registration/interface/userRoutes";
import { AuthService } from "./auth/application/AuthService";
import { AuthController } from "./auth/interface/AuthController";
import { createAuthRouter } from "./auth/interface/authRoutes";
import { optionalAuthMiddleware } from "./auth/interface/optionalAuthMiddleware";
import type { RecoveryTokenRepository } from "./recovery/domain/RecoveryTokenRepository";
import {
  PasswordRecoveryService,
  type RecoveryEmailService,
} from "./recovery/application/PasswordRecoveryService";
import { PasswordRecoveryController } from "./recovery/interface/PasswordRecoveryController";
import { createPasswordRecoveryRouter } from "./recovery/interface/passwordRecoveryRoutes";
import { PasswordResetService } from "./recovery/application/PasswordResetService";
import { PasswordResetController } from "./recovery/interface/PasswordResetController";

const PERFIL_DEMO_ID = "usuario-demo";

export function createApp(
  productRepository: FinancialProductRepository,
  userOrProfileRepository?: UserRepository | RepositorioPerfiles,
  recoveryTokenRepository?: RecoveryTokenRepository,
  recoveryEmailService?: RecoveryEmailService,
  profileRepository: RepositorioPerfiles = new RepositorioPerfilesJson(),
) {
  const isUserRepository = (
    repository: UserRepository | RepositorioPerfiles,
  ): repository is UserRepository => "findByEmail" in repository;
  const userRepository =
    userOrProfileRepository && isUserRepository(userOrProfileRepository)
      ? userOrProfileRepository
      : undefined;
  const selectedProfileRepository =
    userOrProfileRepository && !isUserRepository(userOrProfileRepository)
      ? userOrProfileRepository
      : profileRepository;

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", optionalAuthMiddleware);
  app.use("/api/ahorros", ahorrosRouter);
  const profileService = new ServicioPerfiles(selectedProfileRepository);

  app.get("/api/perfil", (_req, res) => {
    res.json(profileService.obtener(PERFIL_DEMO_ID));
  });

  app.put("/api/perfil", (req, res) => {
    res.json(profileService.actualizar(PERFIL_DEMO_ID, req.body));
  });

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
    if (recoveryTokenRepository && recoveryEmailService) {
      app.use(
        "/api/auth",
        createPasswordRecoveryRouter(
          new PasswordRecoveryController(
            new PasswordRecoveryService(
              userRepository,
              recoveryTokenRepository,
              recoveryEmailService,
            ),
          ),
          new PasswordResetController(new PasswordResetService(recoveryTokenRepository)),
        ),
      );
    }
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof DatosPerfilInvalidosError) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof CorreoDuplicadoError) {
      res.status(409).json({ message: error.message });
      return;
    }
    if (error instanceof PerfilNoEncontradoError) {
      res.status(404).json({ message: error.message });
      return;
    }
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
