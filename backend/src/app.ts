import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { ahorrosRouter } from "./routes/ahorros";
import { FixedDepositSimulationService } from "./simulation/application/FixedDepositSimulationService";
import { InMemoryProductRepository } from "./simulation/infrastructure/InMemoryProductRepository";
import { SimulationController } from "./simulation/interface/SimulationController";

// Arma la aplicación Express: middlewares, rutas de cada HU, conexión de dependencias
// y el manejador global de errores. No escucha ningún puerto (eso lo hace index.ts).
export const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/ahorros", ahorrosRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Composición: aquí se elige la implementación del repositorio (luego, la de BD)
const simulationController = new SimulationController(
  new FixedDepositSimulationService(new InMemoryProductRepository()),
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
