// Punto de entrada y raíz de composición: elige las implementaciones (hoy, el repositorio en
// memoria; luego, el de base de datos) y levanta el servidor. La app se arma en app.ts.
import "dotenv/config";
import { createApp } from "./app";
import { InMemoryProductRepository } from "./simulation/infrastructure/InMemoryProductRepository";
import { SqliteUserRepository } from "./registration/infrastructure/SqliteUserRepository";

const PORT = process.env.PORT ?? 3000;
const users = new SqliteUserRepository(process.env.USER_DB_PATH ?? "data/usuarios.sqlite");
const server = createApp(new InMemoryProductRepository(), users).listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => users.close()));
}
