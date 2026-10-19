// Punto de entrada y raíz de composición: elige las implementaciones (hoy, el repositorio en
// memoria; luego, el de base de datos) y levanta el servidor. La app se arma en app.ts.
import "dotenv/config";
import { createApp } from "./app";
import { InMemoryProductRepository } from "./simulation/infrastructure/InMemoryProductRepository";

const PORT = process.env.PORT ?? 3000;
createApp(new InMemoryProductRepository()).listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
