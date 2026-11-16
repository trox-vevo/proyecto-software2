// US21: migración manual. Vista previa por defecto; --apply requiere --backup NUEVO.
import { closeSync, existsSync, lstatSync, openSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const table = "savings_account_entities";
const associations = JSON.parse(readFileSync(new URL("../backend/db/savings-entity-associations.json", import.meta.url), "utf8"));
const ddl = readFileSync(new URL("../backend/db/savings-entity-links.sql", import.meta.url), "utf8");
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const encode = (value) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? { sqliteInteger: item.toString() } : item);

/** Todas las tablas y esquemas originales, incluidas operaciones, usuarios y favoritos. */
function fingerprint(db) {
  const schema = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name != ? ORDER BY type, name").all(table);
  const hash = createHash("sha256").update(encode(schema));
  for (const entry of schema.filter((entry) => entry.type === "table")) {
    if (/CREATE\s+VIRTUAL\s+TABLE/i.test(entry.sql ?? "")) throw new Error("Esquema virtual no admitido; requiere revisión manual.");
    const columns = db.prepare(`PRAGMA table_info(${quote(entry.name)})`).all();
    const statement = db.prepare(`SELECT * FROM ${quote(entry.name)} ORDER BY ${columns.map((column) => quote(column.name)).join(", ")}`);
    statement.setReadBigInts(true);
    const rows = statement.all();
    hash.update(entry.name).update(encode(rows));
  }
  hash.update(encode(db.prepare("PRAGMA user_version").get()));
  return hash.digest("hex");
}

function plan(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'savings_accounts'").get() ||
      !db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'financial_entities'").get()) {
    throw new Error("Falta el catálogo SQLite de cuentas o entidades. No se creará ni reinicializará.");
  }
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?").get(table)) throw new Error("La asociación tiene triggers; revisar antes de migrar.");
  if (columns.length) {
    const account = columns.find((column) => column.name === "account_id");
    const entity = columns.find((column) => column.name === "entity_id");
    const keys = db.prepare(`PRAGMA foreign_key_list(${table})`).all();
    if (columns.length !== 2 || account?.type !== "TEXT" || account.pk !== 1 || account.notnull !== 1 ||
        entity?.type !== "INTEGER" || entity.pk !== 0 || entity.notnull !== 1 || keys.length !== 2 ||
        !keys.some((key) => key.from === "account_id" && key.table === "savings_accounts" && key.to === "id") ||
        !keys.some((key) => key.from === "entity_id" && key.table === "financial_entities" && key.to === "id")) {
      throw new Error("La tabla de asociación tiene un esquema distinto. No se sustituirá.");
    }
  }
  if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("La base tiene relaciones inválidas; revisar antes de migrar.");
  const changes = [];
  let matched = 0;
  for (const association of associations) {
    if (!db.prepare("SELECT 1 FROM savings_accounts WHERE id = ?").get(association.accountId)) continue;
    matched += 1;
    const entity = db.prepare("SELECT name FROM financial_entities WHERE id = ?").get(association.entityId);
    if (entity?.name !== association.entityName) throw new Error(`Entidad ${association.entityId} incompatible con la asignación revisada. Revisar primero los nombres FSD; no se sobrescribirán.`);
    const previous = columns.length ? db.prepare(`SELECT entity_id FROM ${table} WHERE account_id = ?`).get(association.accountId) : undefined;
    if (previous && previous.entity_id !== association.entityId) throw new Error(`La cuenta ${association.accountId} ya tiene otra asociación; no se cambiará.`);
    if (!previous) changes.push(association);
  }
  if (!matched) throw new Error("No hay cuentas previstas para asociar. No se crearán cuentas nuevas.");
  return { createTable: !columns.length, changes };
}

export async function migrateSavingsEntities({ databaseFile, backupFile, apply = false }) {
  if (!databaseFile) throw new Error("Se requiere --database con una ruta existente.");
  const file = path.resolve(databaseFile);
  if (!existsSync(file) || !lstatSync(file).isFile()) throw new Error("La base debe ser un archivo existente; no se creará.");
  const source = new DatabaseSync(file, { readOnly: true });
  let planned;
  let before;
  try {
    planned = plan(source);
    before = fingerprint(source);
    console.log(`Vista previa: ${planned.changes.length} asociaciones; crear tabla: ${planned.createTable}. Ningún valor de las tablas originales cambia.`);
    if (!apply || (!planned.createTable && !planned.changes.length)) return { applied: false, associations: planned.changes.length };
    if (!backupFile) throw new Error("--apply requiere --backup con una ruta nueva.");
    const destination = path.resolve(backupFile);
    if (destination === file) throw new Error("El respaldo debe ser distinto del origen.");
    closeSync(openSync(destination, "wx"));
    await backup(source, destination);
    const copy = new DatabaseSync(destination, { readOnly: true });
    try {
      if (copy.prepare("PRAGMA integrity_check").get().integrity_check !== "ok" || fingerprint(copy) !== before || encode(plan(copy)) !== encode(planned)) {
        throw new Error("Respaldo inconsistente; la fuente no se modificó.");
      }
    } finally { copy.close(); }
  } finally { source.close(); }

  const db = new DatabaseSync(file);
  let transaction = false;
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; BEGIN IMMEDIATE");
    transaction = true;
    if (fingerprint(db) !== before || encode(plan(db)) !== encode(planned)) throw new Error("La base cambió durante el respaldo; cerrar el backend y repetir la revisión.");
    db.exec(ddl);
    const insert = db.prepare(`INSERT INTO ${table} (account_id, entity_id) VALUES (?, ?)`);
    for (const association of planned.changes) insert.run(association.accountId, association.entityId);
    if (db.prepare("PRAGMA foreign_key_check").all().length || fingerprint(db) !== before || plan(db).changes.length) {
      throw new Error("La verificación de preservación falló; se revierte la migración.");
    }
    db.exec("COMMIT");
    transaction = false;
    console.log(`Migración completada: ${planned.changes.length} asociaciones. Respaldo: ${path.resolve(backupFile)}.`);
    return { applied: true, associations: planned.changes.length };
  } finally {
    if (transaction) db.exec("ROLLBACK");
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const options = { apply: false };
    const used = new Set();
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if (used.has(arg)) throw new Error("Argumento repetido.");
      used.add(arg);
      if (arg === "--apply") options.apply = true;
      else if ((arg === "--database" || arg === "--backup") && args[index + 1] && !args[index + 1].startsWith("--")) options[arg === "--database" ? "databaseFile" : "backupFile"] = args[++index];
      else throw new Error("Uso: --database EXISTENTE [--apply --backup NUEVO]");
    }
    await migrateSavingsEntities(options);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
