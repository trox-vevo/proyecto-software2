import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, expect, it } from "vitest";
import { assertNumericDatabase } from "../../src/favorites/infrastructure/assertNumericDatabase";

const directory = mkdtempSync(join(tmpdir(), "yupay-startup-schema-"));
afterAll(() => {
  if (!realpathSync(directory).startsWith(realpathSync(tmpdir()) + sep)) throw new Error("Limpieza fuera del directorio temporal");
  rmSync(directory, { recursive: true, force: true });
});

it("no crea una base inexistente durante la inspección", () => {
  const path = join(directory, "missing.sqlite");
  assertNumericDatabase(path);
  expect(existsSync(path)).toBe(false);
});

it.each([
  "CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT)",
  "CREATE TABLE users(id INTEGER PRIMARY KEY DESC, email TEXT)",
  "CREATE TABLE users(id INTEGER PRIMARY KEY, email TEXT) WITHOUT ROWID",
  "CREATE TABLE users(id INTEGER PRIMARY KEY); CREATE TABLE favorite_simulations(id INTEGER PRIMARY KEY, user_id TEXT)",
  "CREATE TABLE users(id INTEGER PRIMARY KEY); CREATE TABLE password_recovery_tokens(id INTEGER PRIMARY KEY, user_id TEXT)",
])("bloquea el arranque sin cambiar bytes del esquema anterior: %s", sql => {
  const path = join(directory, `legacy-${Math.random()}.sqlite`);
  const database = new DatabaseSync(path);
  database.exec(sql);
  database.close();
  const before = readFileSync(path);
  expect(() => assertNumericDatabase(path)).toThrow(/migración explícita/);
  expect(readFileSync(path)).toEqual(before);
});

it("no fabrica cuentas si existen relaciones sin tabla de usuarios", () => {
  const path = join(directory, "missing-users.sqlite");
  const database = new DatabaseSync(path);
  database.exec("CREATE TABLE favorite_simulations(id INTEGER PRIMARY KEY, user_id INTEGER)");
  database.close();
  const before = readFileSync(path);
  expect(() => assertNumericDatabase(path)).toThrow(/propietarios artificiales/);
  expect(readFileSync(path)).toEqual(before);
});
