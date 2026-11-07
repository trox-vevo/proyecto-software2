import "dotenv/config";
import { createApp } from "./app";
import { InMemoryProductRepository } from "./simulation/infrastructure/InMemoryProductRepository";
import { SqliteUserRepository } from "./registration/infrastructure/SqliteUserRepository";
import { SmtpRecoveryEmailService } from "./recovery/infrastructure/SmtpRecoveryEmailService";
import { SqliteFavoriteRepository } from "./favorites/infrastructure/SqliteFavoriteRepository";
import { FavoriteService } from "./favorites/application/FavoriteService";
import { createFavoriteUserResolver } from "./favorites/infrastructure/createFavoriteUserResolver";
import { assertNumericDatabase } from "./favorites/infrastructure/assertNumericDatabase";
import { RepositorioCuentas } from "./repositorio/RepositorioCuentas";
import { FixedDepositSimulationService } from "./simulation/application/FixedDepositSimulationService";

const PORT = process.env.PORT ?? 3000;
const file = process.env.USER_DB_PATH ?? "data/usuarios.sqlite";
assertNumericDatabase(file);
const products = new InMemoryProductRepository();
const users = new SqliteUserRepository(file);
const favorites = new SqliteFavoriteRepository(file);
const server = createApp(products, users, users, new SmtpRecoveryEmailService(), undefined, {
  favoriteService: new FavoriteService(favorites, new RepositorioCuentas(), new FixedDepositSimulationService(products)),
  resolveUser: createFavoriteUserResolver(users),
}).listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => {
    try { favorites.close(); } finally { users.close(); }
  }));
}
