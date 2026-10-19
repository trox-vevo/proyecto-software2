import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { ahorrosRouter } from "./routes/ahorros";
import { FixedDepositSimulationService } from "./simulation/application/FixedDepositSimulationService";
import { FinancialProductRepository } from "./simulation/domain/FinancialProductRepository";
import { SimulationController } from "./simulation/interface/SimulationController";

// Arma la aplicación Express: middlewares, rutas de cada HU, conexión de dependencias
// y el manejador global de errores. No escucha ningún puerto (eso lo hace index.ts).
// Recibe el repositorio para que las pruebas usen sus propios datos y no los de demostración.
export function createApp(productRepository: FinancialProductRepository) {
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

  // DoD 5: nunca devolver errores técnicos crudos al usuario
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({ message: "El cuerpo de la petición no es un JSON válido." });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Ocurrió un error inesperado. Inténtalo más tarde." });
  });

  return app;
}
