import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { ahorrosRouter } from "./routes/ahorros";
import { FixedDepositSimulationService } from "./simulation/application/FixedDepositSimulationService";
import { FinancialProductRepository } from "./simulation/domain/FinancialProductRepository";
import { SimulationController } from "./simulation/interface/SimulationController";
import { ServicioPerfiles } from "./profile/application/ServicioPerfiles";
import {
  CorreoDuplicadoError,
  DatosPerfilInvalidosError,
  PerfilNoEncontradoError,
} from "./profile/application/ErroresPerfil";
import { RepositorioPerfilesJson } from "./profile/infrastructure/RepositorioPerfilesJson";
import type { RepositorioPerfiles } from "./profile/domain/RepositorioPerfiles";

const PERFIL_DEMO_ID = "usuario-demo";

// Arma la aplicación Express: middlewares, rutas de cada HU, conexión de dependencias
// y el manejador global de errores. No escucha ningún puerto (eso lo hace index.ts).
// Recibe el repositorio para que las pruebas usen sus propios datos y no los de demostración.
export function createApp(
  productRepository: FinancialProductRepository,
  profileRepository: RepositorioPerfiles = new RepositorioPerfilesJson(),
) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api/ahorros", ahorrosRouter);
  const profileService = new ServicioPerfiles(profileRepository);

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

  // DoD 5: nunca devolver errores técnicos crudos al usuario
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
      res.status(400).json({ message: "El cuerpo de la petición no es un JSON válido." });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Ocurrió un error inesperado. Inténtalo más tarde." });
  });

  return app;
}
