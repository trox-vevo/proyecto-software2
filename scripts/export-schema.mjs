// Genera el script de creación de la base de datos (entregable 1.2.7 del enunciado) a partir de la base REAL:
// levanta el backend compilado con una base nueva y temporal, para que cada repositorio cree sus tablas,
// y luego copia el esquema (sqlite_master) a un archivo .sql. Así el script nunca se desalinea del código.
//
// Uso (desde la raíz, con el backend compilado: npm run build --prefix backend):
//   node scripts/export-schema.mjs BaseDeDatos/schema.sql
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const output = process.argv[2] ?? "BaseDeDatos/schema.sql";
const root = fileURLToPath(new URL("../", import.meta.url));
const tempDir = mkdtempSync(path.join(tmpdir(), "yupay-schema-"));
const dbFile = path.join(tempDir, "schema.sqlite");
const port = 4700 + Math.floor(Math.random() * 200);

const server = spawn(process.execPath, ["dist/index.js"], {
  cwd: path.join(root, "backend"),
  env: { ...process.env, PORT: String(port), DB_PATH: dbFile, USER_DB_PATH: dbFile, JWT_SECRET: "schema-export" },
  stdio: "ignore",
});

try {
  for (let i = 0; ; i += 1) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch { /* arrancando */ }
    if (i > 50) throw new Error("El backend no arrancó. ¿Ejecutaste npm run build --prefix backend?");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
} finally {
  server.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
}

const database = new DatabaseSync(dbFile, { readOnly: true });
const rows = database.prepare(
  "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name",
).all();
database.close();
rmSync(tempDir, { recursive: true, force: true });

const header = [
  "-- Yupay Finance: esquema completo de la base de datos (SQLite).",
  "-- Generado automáticamente con: node scripts/export-schema.mjs",
  "-- Los datos de demostración del catálogo están en backend/db/seed.sql.",
  "",
];
const body = rows.map((row) => `${String(row.sql).trim().replace(/^CREATE (TABLE|INDEX)/, "CREATE $1 IF NOT EXISTS")};`);
mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
writeFileSync(output, `${header.join("\n")}${body.join("\n\n")}\n`);
console.log(`✓ ${rows.length} tablas e índices escritos en ${output}`);
