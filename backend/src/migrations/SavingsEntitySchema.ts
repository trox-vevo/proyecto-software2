import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const associations = JSON.parse(readFileSync(path.join(__dirname, "../../db/savings-entity-associations.json"), "utf8")) as { accountId: string }[];

/** Inspección de solo lectura, anterior a cualquier escritura de los repositorios. */
export function assertSavingsEntityMigration(file: string): void {
  if (file === ":memory:" || !existsSync(file)) return;
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'savings_accounts'").get()) return;
    const columns = db.prepare("PRAGMA table_info(savings_account_entities)").all();
    const account = columns.find((column) => column.name === "account_id");
    const entity = columns.find((column) => column.name === "entity_id");
    const keys = db.prepare("PRAGMA foreign_key_list(savings_account_entities)").all();
    if (columns.length !== 2 || account?.type !== "TEXT" || account.pk !== 1 || account.notnull !== 1 || entity?.type !== "INTEGER" || entity.pk !== 0 || entity.notnull !== 1 ||
      keys.length !== 2 || !keys.some((key) => key.from === "account_id" && key.table === "savings_accounts" && key.to === "id") ||
      !keys.some((key) => key.from === "entity_id" && key.table === "financial_entities" && key.to === "id")) throw new Error("schema");
    const missing = db.prepare("SELECT s.id FROM savings_accounts s LEFT JOIN savings_account_entities a ON a.account_id = s.id WHERE s.id = ? AND a.account_id IS NULL");
    if (associations.some((association) => missing.get(association.accountId))) throw new Error("links");
    if (db.prepare("PRAGMA foreign_key_check(savings_account_entities)").all().length) throw new Error("foreign keys");
  } catch {
    throw new Error("US21 requiere la migración explícita con respaldo de asociaciones de ahorro. Ejecuta scripts/link-savings-entities.mjs antes de iniciar. La inspección no modificó la base.");
  } finally { db.close(); }
}
