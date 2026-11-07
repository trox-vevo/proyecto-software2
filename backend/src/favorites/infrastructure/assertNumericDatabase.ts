import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

/** Solo inspecciona. Impide que el arranque migre IDs sin actualizar sus relaciones. */
export function assertNumericDatabase(file: string): void {
  if (file === ":memory:" || !existsSync(file)) return;
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    for (const table of ["users", "favorite_simulations", "password_recovery_tokens"] as const) {
      const columns = database.prepare(`PRAGMA table_info(${table})`).all();
      if (!columns.length) continue;
      const keys = columns.filter(column => column.pk !== 0);
      const owner = columns.find(column => column.name === "user_id");
      const indexedPrimaryKey = database.prepare(`PRAGMA index_list(${table})`).all().some(index => index.origin === "pk");
      if (keys.length !== 1 || keys[0].name !== "id" || String(keys[0].type).toUpperCase() !== "INTEGER" || indexedPrimaryKey ||
          (table !== "users" && (!owner || String(owner.type).toUpperCase() !== "INTEGER"))) {
        throw new Error("La base requiere una migración explícita con respaldo de usuarios, favoritos y recuperación. El arranque no modificó sus datos.");
      }
      if (table !== "users" && !database.prepare("PRAGMA table_info(users)").all().length) {
        throw new Error("Falta la tabla de usuarios: no se crearán propietarios artificiales. Revisa la base antes de iniciar.");
      }
    }
  } finally { database.close(); }
}
