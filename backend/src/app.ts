import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { createAhorrosRouter, type FuenteCuentas } from "./routes/ahorros";
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
import { RiskEvaluationService } from "./risk/application/RiskEvaluationService";
import { JsonSbsRiskRepository } from "./risk/infrastructure/JsonSbsRiskRepository";
import { EconomistReportService } from "./risk/application/EconomistReportService";
import { JsonEconomistReportRepository } from "./risk/infrastructure/JsonEconomistReportRepository";
import type { SbsRiskRepository } from "./risk/domain/SbsRiskRepository";
import type { EconomistReportRepository } from "./risk/domain/EconomistReportRepository";
import { EconomistReportController } from "./risk/interface/EconomistReportController";
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
import { CheckoutHistoryService } from "./checkout/CheckoutHistoryService";
import { PaymentReceiptGenerator } from "./checkout/PaymentReceiptGenerator";
import type { CheckoutPaymentHistoryRepository } from "./checkout/CheckoutPaymentHistory";
import { SubscriptionService } from "./subscription/application/SubscriptionService";
import { SubscriptionController } from "./subscription/interface/SubscriptionController";
import { createSubscriptionRouter } from "./subscription/interface/subscriptionRoutes";
import type { SubscriptionMaintenanceRepository } from "./subscription/domain/SubscriptionMaintenanceRepository";
import { createFavoriteRouter } from "./favorites/interface/favoriteRoutes";
import type { FavoriteService } from "./favorites/application/FavoriteService";
import type { ResolveUser } from "./favorites/domain/Favorite";
import { NotificationPreferencesController } from "./notifications/NotificationPreferencesController";
import {
  type NotificationPreferencesRepository,
} from "./notifications/NotificationPreferences";
import { NotificationPreferencesService } from "./notifications/NotificationPreferencesService";
import { createNotificationPreferencesRouter } from "./notifications/notificationPreferencesRoutes";
import type { ServicioAlertas } from "./alertas/application/ServicioAlertas";
import { createAlertasRouter } from "./alertas/interface/alertasRoutes";

export interface Sprint3Dependencies {
  resolveUser?: ResolveUser;
  favoriteService?: FavoriteService;
  notificationPreferencesRepository?: NotificationPreferencesRepository;
  // Base de datos única: si no se pasan, se usan los JSON de data/ (como antes)
  savingsAccounts?: FuenteCuentas;
  sbsRiskRepository?: SbsRiskRepository;
  economistReportRepository?: EconomistReportRepository;
  alertas?: ServicioAlertas;
}


const PERFIL_DEMO_ID = "usuario-demo";

function supportsSubscriptionMaintenance(
  repository: UserRepository,
): repository is UserRepository & Pick<
  SubscriptionMaintenanceRepository,
  "recordRenewalPaymentFailure" | "findPlanChangeHistory"
> {
  return "recordRenewalPaymentFailure" in repository &&
    typeof repository.recordRenewalPaymentFailure === "function" &&
    "findPlanChangeHistory" in repository &&
    typeof repository.findPlanChangeHistory === "function";
}

function supportsCheckoutPaymentHistory(
  repository: UserRepository,
): repository is UserRepository & CheckoutPaymentHistoryRepository {
  return "recordCheckoutAttempt" in repository &&
    typeof repository.recordCheckoutAttempt === "function" &&
    "recordApprovedCheckout" in repository &&
    typeof repository.recordApprovedCheckout === "function" &&
    "findCheckoutHistory" in repository &&
    typeof repository.findCheckoutHistory === "function" &&
    "findCheckoutReceipt" in repository &&
    typeof repository.findCheckoutReceipt === "function";
}

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
  // US22/US23: el semáforo de ahorros sale de la misma calificación SBS que plazo fijo
  app.use("/api/ahorros", createAhorrosRouter(dependencies.savingsAccounts, dependencies.sbsRiskRepository ?? new JsonSbsRiskRepository()));
  app.get("/api/plans", (_req, res) => res.json({ plans: PLANS, features: PLAN_FEATURES }));
  // US33: sin repositorio de usuarios (algunas pruebas), nadie puede pagar (401).
  const paymentHistoryRepository = userRepository && supportsCheckoutPaymentHistory(userRepository)
    ? userRepository
    : undefined;
  const checkoutController = new CheckoutController(new PaymentProcessingService(
    new MockPaymentService(),
    userRepository ?? { findById: () => null },
    () => new Date(),
    paymentHistoryRepository,
  ), new CheckoutHistoryService(paymentHistoryRepository), new PaymentReceiptGenerator());
  app.use("/api/checkout", createCheckoutRouter(checkoutController));
  // US27: los privilegios se consultan en el repositorio, incluido el vencimiento del período.
  const proAccessService = new ProAccessService(userRepository ?? { findById: () => null });
  const subscriptionService = new SubscriptionService(
    userRepository ?? { findById: () => null, requestProCancellation: () => {} },
    () => new Date(),
    userRepository && supportsSubscriptionMaintenance(userRepository) ? userRepository : undefined,
  );
  app.use("/api/subscription", createSubscriptionRouter(
    new SubscriptionController(subscriptionService, process.env.SUBSCRIPTION_WEBHOOK_SECRET),
  ));
  app.use("/api/favorites", createFavoriteRouter(
    dependencies.resolveUser ?? (async () => null),
    dependencies.favoriteService,
    userRepository ? proAccessService : undefined,
  ));
  if (dependencies.alertas) {
    const resolveUser = dependencies.resolveUser ?? (async () => null);
    app.use("/api/alertas", createAlertasRouter(
      dependencies.alertas,
      async (req) => (await resolveUser(req))?.id ?? null,
    ));
  }
  
  const notificationPreferencesRepository =
    dependencies.notificationPreferencesRepository ??
    (userRepository && supportsNotificationPreferences(userRepository) ? userRepository : undefined);
  const notificationPreferencesController = new NotificationPreferencesController(
    notificationPreferencesRepository
      ? new NotificationPreferencesService(notificationPreferencesRepository)
      : undefined,
  );
  app.use(
    "/api/notifications",
    new ProAccessMiddleware(
      proAccessService,
      "Esta función está disponible solo para usuarios Pro. Actualiza tu plan para personalizar tus alertas.",
    ).handle,
    createNotificationPreferencesRouter(notificationPreferencesController),
  );
  const profileService = new ServicioPerfiles(selectedProfileRepository);

  // US16: con sesión se usa el perfil del usuario autenticado. Sin sesión, el perfil de demostración,
  // que solo existe en el repositorio JSON de las pruebas; con la base de datos se pide iniciar sesión.
  const perfilId = (userId: number | undefined) => (userId === undefined ? PERFIL_DEMO_ID : String(userId));
  const requiereSesion = (userId: number | undefined) =>
    userId === undefined && selectedProfileRepository.buscarPorId(PERFIL_DEMO_ID) === undefined;

  app.get("/api/perfil", (req, res) => {
    if (requiereSesion(req.userId)) {
      res.status(401).json({ message: "Inicia sesión para ver y editar tu perfil." });
      return;
    }
    res.json(profileService.obtener(perfilId(req.userId)));
  });

  app.put("/api/perfil", (req, res) => {
    if (requiereSesion(req.userId)) {
      res.status(401).json({ message: "Inicia sesión para ver y editar tu perfil." });
      return;
    }
    res.json(profileService.actualizar(perfilId(req.userId), req.body));
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // US27: una sola regla de acceso Pro para el informe (403) y la simulación (oculta la calificación).
  // Sin repositorio de usuarios (algunas pruebas), nadie es Pro.
  const proAccessMiddleware = new ProAccessMiddleware(proAccessService);
  app.use("/api/risk-reports", proAccessMiddleware.handle); // protege la ruta de la US26

  // US25: calificación de riesgo de la SBS para cada resultado de plazo fijo
  const sbsRiskRepository = dependencies.sbsRiskRepository ?? new JsonSbsRiskRepository();
  const riskEvaluationService = new RiskEvaluationService(sbsRiskRepository);

  // US26: informe del economista; ProAccessMiddleware (arriba) ya dejó pasar solo a usuarios Pro
  const economistReportController = new EconomistReportController(
    new EconomistReportService(dependencies.economistReportRepository ?? new JsonEconomistReportRepository(), sbsRiskRepository),
  );
  app.get("/api/risk-reports/:entityId", economistReportController.getReport);

  // US30: Reporte de Solvencia en PDF, solo Pro (401/403 con la misma regla de la US27).
  app.use("/api/reports", proAccessMiddleware.handle);
  const reportController = new ReportController(new SolvencyReportService(
    new FixedDepositSimulationService(productRepository, riskEvaluationService),
    new PdfKitGenerator(),
  ));
  app.post("/api/reports/solvency", reportController.downloadSolvencyReport);

  const simulationController = new SimulationController(
    new FixedDepositSimulationService(productRepository, riskEvaluationService),
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

function supportsNotificationPreferences(
  repository: UserRepository,
): repository is UserRepository & NotificationPreferencesRepository {
  return "findNotificationPreferences" in repository &&
    typeof repository.findNotificationPreferences === "function" &&
    "saveNotificationPreferences" in repository &&
    typeof repository.saveNotificationPreferences === "function";
}
