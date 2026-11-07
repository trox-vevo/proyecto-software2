import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AddressInfo } from "node:net";
import { createApp } from "../../../src/app";
import { FavoriteService } from "../../../src/favorites/application/FavoriteService";
import { SqliteFavoriteRepository } from "../../../src/favorites/infrastructure/SqliteFavoriteRepository";
import { RepositorioCuentas } from "../../../src/repositorio/RepositorioCuentas";
import { FixedDepositSimulationService } from "../../../src/simulation/application/FixedDepositSimulationService";
import { InMemoryProductRepository } from "../../../src/simulation/infrastructure/InMemoryProductRepository";

// Servidor exclusivo de pruebas de integración. Se inicia únicamente con NODE_ENV=test.
if (process.env.NODE_ENV !== "test" || !process.send) throw new Error("Este fixture requiere el proceso de pruebas.");
const directory = mkdtempSync(join(tmpdir(), "yupay-sprint3-integration-"));
const file = join(directory, "users.sqlite");
const users = new DatabaseSync(file);
users.exec("CREATE TABLE users (id INTEGER PRIMARY KEY)");
users.exec("INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES;");
users.close();
const favorites = new SqliteFavoriteRepository(file);
const products = new InMemoryProductRepository();
const server = createApp(products, {
  favoriteService: new FavoriteService(favorites, new RepositorioCuentas(), new FixedDepositSimulationService(products)),
  resolveUser: async (request) => {
    if (request.headers.authorization === "Bearer integration-pro") return { id: 1, plan: "PRO" };
    if (request.headers.authorization === "Bearer integration-basic") return { id: 2, plan: "BASICO" };
    return null;
  },
}).listen(0, "127.0.0.1", () => {
  process.send!({ port: (server.address() as AddressInfo).port });
});

process.once("message", () => {
  server.close(() => {
    favorites.close();
    rmSync(directory, { recursive: true, force: true });
    process.disconnect();
  });
});
