import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import { createApp } from "../../../src/app";
import { getJwtSecret } from "../../../src/auth/jwtSecret";
import { createFavoriteUserResolver } from "../../../src/favorites/infrastructure/createFavoriteUserResolver";
import { SqliteUserRepository } from "../../../src/registration/infrastructure/SqliteUserRepository";
import { FavoriteService } from "../../../src/favorites/application/FavoriteService";
import { SqliteFavoriteRepository } from "../../../src/favorites/infrastructure/SqliteFavoriteRepository";
import { RepositorioCuentas } from "../../../src/repositorio/RepositorioCuentas";
import { FixedDepositSimulationService } from "../../../src/simulation/application/FixedDepositSimulationService";
import { InMemoryProductRepository } from "../../../src/simulation/infrastructure/InMemoryProductRepository";

// Servidor exclusivo de pruebas de integración. Se inicia únicamente con NODE_ENV=test.
if (process.env.NODE_ENV !== "test" || !process.send) throw new Error("Este fixture requiere el proceso de pruebas.");
const directory = mkdtempSync(join(tmpdir(), "yupay-sprint3-integration-"));
const file = join(directory, "users.sqlite");
// US33: usuarios reales para que favoritos y pago (JWT) vean la misma identidad.
const users = new SqliteUserRepository(file);
const createUser = (name: string, plan: "BASICO" | "PRO") => jwt.sign({ sub: String(users.create({
  username: name, email: `${name}@integration.test`, passwordHash: "h", plan, createdAt: new Date().toISOString(),
}).id) }, getJwtSecret());
// Un usuario por prueba que cambia de plan, para que el orden de las pruebas no importe.
const tokens = {
  pro: createUser("pro", "PRO"),
  basic: createUser("basic", "BASICO"),
  declineThenApprove: createUser("retry", "BASICO"),
  upgrade: createUser("upgrade", "BASICO"),
};
const favorites = new SqliteFavoriteRepository(file);
const products = new InMemoryProductRepository();
const server = createApp(products, users, undefined, undefined, undefined, {
  favoriteService: new FavoriteService(favorites, new RepositorioCuentas(), new FixedDepositSimulationService(products)),
  resolveUser: createFavoriteUserResolver(users),
}).listen(0, "127.0.0.1", () => {
  process.send!({ port: (server.address() as AddressInfo).port, tokens });
});

process.once("message", () => {
  server.close(() => {
    favorites.close();
    users.close();
    rmSync(directory, { recursive: true, force: true });
    process.disconnect();
  });
});
