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
import { ProAccessService } from "./auth/application/ProAccessService";
import { ProAccessMiddleware } from "./auth/interface/ProAccessMiddleware";
import { RiskRatingFilter } from "./simulation/application/RiskRatingFilter";
import type { RecoveryTokenRepository } from "./recovery/domain/RecoveryTokenRepository";
import {
  PasswordRecoveryService,
  type RecoveryEmailService,
} from "./recovery/application/PasswordRecoveryService";
import { PasswordRecoveryController } from "./recovery/interface/PasswordRecoveryController";
import { createPasswordRecoveryRouter } from "./recovery/interface/passwordRecoveryRoutes";
import { PasswordResetService } from "./recovery/application/PasswordResetService";
import { PasswordResetController } from "./recovery/interface/PasswordResetController";

import { PLAN_FEATURES, PLANS } from "./plans/Plan";
import { createCheckoutRouter } from "./checkout/checkoutRoutes";
import { SolvencyReportService } from "./reports/application/SolvencyReportService";
import { PdfKitGenerator } from "./reports/infrastructure/PdfKitGenerator";
import { ReportController } from "./reports/interface/ReportController";
import { CheckoutController } from "./checkout/CheckoutController";
import { MockPaymentService } from "./checkout/MockPaymentService";
import { PaymentProcessingService } from "./checkout/PaymentProcessingService";
import { createFavoriteRouter } from "./favorites/interface/favoriteRoutes";
import type { FavoriteService } from "./favorites/application/FavoriteService";
import type { ResolveUser } from "./favorites/domain/Favorite";

export interface Sprint3Dependencies {
  resolveUser?: ResolveUser;
  favoriteService?: FavoriteService;
}


const PERFIL_DEMO_ID = "usuario-demo";

export function createApp(
  productRepository: FinancialProductRepository,
  userOrProfileRepository?: UserRepository | RepositorioPerfiles | Sprint3Dependencies,
  recoveryTokenRepository?: RecoveryTokenRepository,
  recoveryEmailService?: RecoveryEmailService,
  profileRepository: RepositorioPerfiles = new RepositorioPerfilesJson(),
  sprint3Dependencies: Sprint3Dependencies = {},
) {
  const isUserRepository = (
    repository: UserRepository | RepositorioPerfiles | Sprint3Dependencies,
  ): repository is UserRepository => "findByEmail" in repository;
  const userRepository =
    userOrProfileRepository && isUserRepository(userOrProfileRepository)
      ? userOrProfileRepository
      : undefined;
  const isProfileRepository = (
    repository: UserRepository | RepositorioPerfiles | Sprint3Dependencies,
  ): repository is RepositorioPerfiles => "buscarPorId" in repository;
  const selectedProfileRepository =
    userOrProfileRepository && isProfileRepository(userOrProfileRepository)
      ? userOrProfileRepository
      : profileRepository;
  const dependencies = userOrProfileRepository && !isUserRepository(userOrProfileRepository) && !isProfileRepository(userOrProfileRepository)
    ? userOrProfileRepository
    : sprint3Dependencies;

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", optionalAuthMiddleware);
  app.use("/api/ahorros", ahorrosRouter);
  app.get("/api/plans", (_req, res) => res.json({ plans: PLANS, features: PLAN_FEATURES }));
  // US33: sin repositorio de usuarios (algunas pruebas), nadie puede pagar (401).
  const checkoutController = new CheckoutController(new PaymentProcessingService(
    new MockPaymentService(),
    userRepository ?? { findById: () => null, activatePro: () => {} },
  ));
  app.use("/api/checkout", createCheckoutRouter(checkoutController));
  app.use("/api/favorites", createFavoriteRouter(dependencies.resolveUser ?? (async () => null), dependencies.favoriteService));
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

  // US27: una sola regla de acceso Pro para el informe (403) y la simulación (oculta la calificación).
  // Sin repositorio de usuarios (algunas pruebas), nadie es Pro.
  const proAccessService = new ProAccessService(userRepository ?? { findById: () => null });
  const proAccessMiddleware = new ProAccessMiddleware(proAccessService);
  app.use("/api/risk-reports", proAccessMiddleware.handle); // protege la ruta de la US26

  // US30: Reporte de Solvencia en PDF, solo Pro (401/403 con la misma regla de la US27).
  app.use("/api/reports", proAccessMiddleware.handle);
  const reportController = new ReportController(new SolvencyReportService(
    new FixedDepositSimulationService(productRepository),
    new PdfKitGenerator(),
  ));
  app.post("/api/reports/solvency", reportController.downloadSolvencyReport);

  const simulationController = new SimulationController(
    new FixedDepositSimulationService(productRepository),
    new RiskRatingFilter(proAccessService),
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
