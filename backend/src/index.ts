// Punto de entrada: carga .env y levanta el servidor. La app (rutas, dependencias)
// se arma en app.ts, separada para que las pruebas la usen sin abrir el puerto 3000.
import "dotenv/config";
import { app } from "./app";

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
