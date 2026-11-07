// Punto de entrada y raíz de composición: elige las implementaciones (hoy, el repositorio en
// memoria; luego, el de base de datos) y levanta el servidor. La app se arma en app.ts.
import "dotenv/config";
import { createApp } from "./app";
import { InMemoryProductRepository } from "./simulation/infrastructure/InMemoryProductRepository";
import { SqliteFavoriteRepository } from "./favorites/infrastructure/SqliteFavoriteRepository";
import { FavoriteService } from "./favorites/application/FavoriteService";
import { RepositorioCuentas } from "./repositorio/RepositorioCuentas";
import { FixedDepositSimulationService } from "./simulation/application/FixedDepositSimulationService";

const PORT = process.env.PORT ?? 3000;
const products = new InMemoryProductRepository();
const favorites = new SqliteFavoriteRepository(process.env.USER_DB_PATH ?? "data/usuarios.sqlite");
const server = createApp(products, {
  favoriteService: new FavoriteService(favorites, new RepositorioCuentas(), new FixedDepositSimulationService(products)),
  // La autenticación del equipo debe aportar resolveUser tras verificar la sesión.
}).listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => favorites.close()));
}
