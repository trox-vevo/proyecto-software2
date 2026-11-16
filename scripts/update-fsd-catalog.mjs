// Actualización manual de datos, nunca invocada por el arranque del backend.
// Vista previa: node scripts/update-fsd-catalog.mjs --database RUTA
// Aplicar: añadir --apply --backup RUTA_NUEVA (cerrar antes el backend).
import { closeSync, existsSync, lstatSync, openSync, readFileSync } from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const revision = JSON.parse(readFileSync(new URL("../backend/db/fsd-verificacion-2026-11-15.json", import.meta.url), "utf8"));
const entries = revision.entidades.filter((entry) => entry.idExistente !== null);
const encoded = (value) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);
const coverageFor = (entry) => ({
  estado: entry.verificadaFsd ? "CUBIERTO" : "NO_VERIFICADO",
  entidadFinanciera: entry.nombre,
  fechaVerificacion: revision.consultadoEl,
  vigenteHasta: entry.verificadaFsd ? revision.revisionLocalHasta : null,
  fuente: entry.verificadaFsd ? revision.fuenteMiembros : revision.fuenteSbs,
});

function validate(database) {
  const triggers = database.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'financial_entities'").all();
  if (triggers.length) throw new Error("La tabla tiene triggers: se requiere revisión manual antes de actualizar.");
  const rows = database.prepare("SELECT * FROM financial_entities ORDER BY id").all();
  const changes = [];
  for (const entry of entries) {
    const row = rows.find((item) => item.id === entry.idExistente);
    if (!row) continue; // No se crean filas que no existían en esta base.
    const expected = coverageFor(entry);
    if (row.name !== entry.nombreAnterior && row.name !== entry.nombre) {
      throw new Error(`ID ${entry.idExistente}: nombre personalizado o asociación diferente; no se sobrescribirá.`);
    }
    let evidence;
    try { evidence = row.fsd_coverage === null ? null : JSON.parse(row.fsd_coverage); }
    catch { throw new Error(`ID ${entry.idExistente}: evidencia no reconocida; revisar manualmente.`); }
    const legacy = [1, 2, 3, 5].includes(entry.idExistente) ? {
      estado: entry.idExistente === 3 ? "NO_CUBIERTO" : "CUBIERTO", entidadFinanciera: entry.nombreAnterior,
      fechaVerificacion: "2026-10-15", vigenteHasta: "2027-12-31", fuente: "https://www.fsd.org.pe/",
    } : null;
    const sameObject = (a, b) => a !== null && b !== null &&
      Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((key) => a[key] === b[key]);
    // Revisión anterior de esta misma consulta (vencía el 22/11/2026): se reconoce para poder extenderla.
    const previous = entry.verificadaFsd ? { ...expected, vigenteHasta: "2026-11-22" } : null;
    if (evidence !== null && !sameObject(evidence, legacy) && !sameObject(evidence, expected) && !sameObject(evidence, previous)) {
      throw new Error(`ID ${entry.idExistente}: evidencia personalizada; no se sobrescribirá.`);
    }
    if (rows.some((other) => other.id !== row.id && other.name === entry.nombre)) {
      throw new Error(`ID ${entry.idExistente}: el nombre destino pertenece a otro ID.`);
    }
    if (row.name !== entry.nombre || !sameObject(evidence, expected)) {
      changes.push({ id: row.id, name: entry.nombre, fsd: JSON.stringify(expected) });
    }
  }
  if (!entries.some((entry) => rows.some((row) => row.id === entry.idExistente))) {
    throw new Error("No hay filas del catálogo original que actualizar.");
  }
  return { rows, changes };
}

export async function updateCatalog({ databaseFile, backupFile, apply = false }) {
  const file = path.resolve(databaseFile);
  if (!existsSync(file) || !lstatSync(file).isFile()) throw new Error("La base debe ser un archivo existente; no se creará ni reinicializará.");
  const source = new DatabaseSync(file, { readOnly: true });
  let planned;
  try {
    planned = validate(source);
    console.log(`Vista previa: ${planned.changes.length} filas; solo financial_entities.name y fsd_coverage.`);
    if (!apply || planned.changes.length === 0) return { changed: 0, planned: planned.changes.length };
    if (!backupFile) throw new Error("--apply requiere --backup con una ruta nueva.");
    const today = new Date().toISOString().slice(0, 10);
    if (today < revision.consultadoEl || today > revision.revisionLocalHasta) {
      console.warn("Revisión local FSD fuera de fecha: el validador mostrará NO_VERIFICADO. Este script no renueva evidencia; se requiere una nueva consulta manual.");
    }
    const destination = path.resolve(backupFile);
    if (file === destination) throw new Error("El respaldo debe ser distinto del origen.");
    // Reserva exclusiva: no se sobreescribe ningún archivo, ni siquiera un respaldo anterior.
    closeSync(openSync(destination, "wx"));
    await backup(source, destination);
    const copy = new DatabaseSync(destination, { readOnly: true });
    try {
      if (copy.prepare("PRAGMA integrity_check").get().integrity_check !== "ok" ||
        encoded(validate(copy).rows) !== encoded(planned.rows)) throw new Error("No se pudo verificar el respaldo.");
    } finally { copy.close(); }
  } finally { source.close(); }

  const database = new DatabaseSync(file);
  let transaction = false;
  try {
    database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; BEGIN IMMEDIATE");
    transaction = true;
    const current = validate(database);
    if (encoded(current.rows) !== encoded(planned.rows)) throw new Error("El catálogo cambió durante el respaldo; vuelva a revisar con el backend cerrado.");
    const foreignKeysBefore = encoded(database.prepare("PRAGMA foreign_key_check").all());
    const update = database.prepare("UPDATE financial_entities SET name = ?, fsd_coverage = ? WHERE id = ?");
    for (const row of current.changes) {
      if (update.run(row.name, row.fsd, row.id).changes !== 1) throw new Error("No se actualizó exactamente una fila.");
    }
    if (foreignKeysBefore !== encoded(database.prepare("PRAGMA foreign_key_check").all())) throw new Error("Cambió la integridad referencial.");
    database.exec("COMMIT");
    transaction = false;
    console.log(`Actualizadas ${current.changes.length} filas. Respaldo conservado en ${path.resolve(backupFile)}.`);
    return { changed: current.changes.length, planned: current.changes.length };
  } finally {
    if (transaction) database.exec("ROLLBACK");
    database.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const options = { apply: false };
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === "--apply") options.apply = true;
      else if ((arg === "--database" || arg === "--backup") && args[index + 1] && !args[index + 1].startsWith("--")) {
        options[arg === "--database" ? "databaseFile" : "backupFile"] = args[++index];
      } else throw new Error("Uso: --database RUTA [--apply --backup RUTA_NUEVA]");
    }
    if (!options.databaseFile) throw new Error("Se requiere --database con la ruta de la base existente.");
    await updateCatalog(options);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
