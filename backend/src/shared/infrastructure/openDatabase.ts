import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// backend/db: la misma ruta relativa sirve desde src/ (tsx, vitest) y desde dist/ (node)
const SQL_DIR = path.join(__dirname, "..", "..", "..", "db");

/**
 * Abre la base de datos única de Yupay y crea/llena el catálogo financiero.
 * Es idempotente: CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE, así que reiniciar no duplica nada.
 * Las tablas de usuarios, pagos y favoritos las siguen creando sus repositorios.
 */
export function openDatabase(file: string): DatabaseSync {
  const database = new DatabaseSync(file);
  database.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON");
  database.exec(readFileSync(path.join(SQL_DIR, "schema.sql"), "utf-8"));
  database.exec(readFileSync(path.join(SQL_DIR, "seed.sql"), "utf-8"));
  return database;
}
