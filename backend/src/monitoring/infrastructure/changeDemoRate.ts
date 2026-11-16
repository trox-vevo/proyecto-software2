import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import Decimal from "decimal.js";
import { userId } from "../../notifications/queue/domain/QueueValidation";

export function changeDemoRate(file: string, productId: number, tea: string): void {
  userId(productId);
  const value = new Decimal(tea);
  if (!value.isFinite() || value.isNegative()) throw new TypeError("TEA no negativa requerida.");
  const db = new DatabaseSync(file, { readOnly: false });
  try {
    db.exec("PRAGMA busy_timeout=5000");
    const result = db.prepare("UPDATE fixed_deposit_products SET tea=? WHERE id=?").run(value.toString(), productId);
    if (Number(result.changes) !== 1) throw new Error("Producto no encontrado.");
  } finally { db.close(); }
}

if (require.main === module) {
  if (process.env.NODE_ENV === "production" || process.env.MARKET_DEMO_ENABLED !== "true" || !process.env.DB_PATH) {
    throw new Error("Usa una copia explícita en DB_PATH y MARKET_DEMO_ENABLED=true fuera de producción.");
  }
  changeDemoRate(process.env.DB_PATH, Number(process.argv[2]), process.argv[3]);
  console.log("Tasa de demostración actualizada. El próximo ciclo evaluará el cambio.");
}
