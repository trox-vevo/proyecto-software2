import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { SqlitePerfilRepository } from "../../src/profile/infrastructure/SqlitePerfilRepository";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";
import { RepositorioCuentas } from "../../src/repositorio/RepositorioCuentas";
import { RepositorioCuentasSqlite } from "../../src/repositorio/RepositorioCuentasSqlite";
import { JsonEconomistReportRepository } from "../../src/risk/infrastructure/JsonEconomistReportRepository";
import { JsonSbsRiskRepository } from "../../src/risk/infrastructure/JsonSbsRiskRepository";
import { SqliteEconomistReportRepository } from "../../src/risk/infrastructure/SqliteEconomistReportRepository";
import { SqliteSbsRiskRepository } from "../../src/risk/infrastructure/SqliteSbsRiskRepository";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";
import { validarCoberturaFSD } from "../../src/fsd/CoberturaFSD";
import type { CuentaAhorros } from "../../src/rentabilidad/CuentaAhorros";
import { InMemoryProductRepository } from "../../src/simulation/infrastructure/InMemoryProductRepository";
import { SqliteProductRepository } from "../../src/simulation/infrastructure/SqliteProductRepository";

// Paridad: la base única debe devolver EXACTAMENTE lo mismo que las fuentes anteriores (JSON / memoria).
// Si alguien cambia db/seed.sql o los JSON de data/, estas pruebas avisan que se desalinearon.
const directories: string[] = [];
function tempFile(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "yupay-db-"));
  directories.push(directory);
  return path.join(directory, "test.sqlite");
}
afterEach(() => {
  while (directories.length) rmSync(directories.pop() as string, { recursive: true, force: true });
});

// Decimal y Date no se comparan bien con toEqual: se convierten a texto comparable
const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (_key, v: unknown) =>
  v !== null && typeof v === "object" && "toFixed" in (v as object) ? (v as { toString(): string }).toString() : v));

describe("openDatabase", () => {
  it("es idempotente: abrirla dos veces no duplica el catálogo", () => {
    const file = tempFile();
    openDatabase(file).close();
    const database = openDatabase(file);
    try {
      const count = (table: string) =>
        (database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
      expect(count("financial_entities")).toBe(6);
      expect(count("fixed_deposit_products")).toBe(6);
      expect(count("savings_accounts")).toBe(6);
      expect(count("sbs_risk_profiles")).toBe(6);
      expect(count("economist_reports")).toBe(6);
    } finally { database.close(); }
  });
});

describe("paridad con las fuentes anteriores", () => {
  it("productos de plazo fijo conservan parámetros y comparten la evidencia FSD revisada", async () => {
    const database = openDatabase(":memory:");
    const sqlite = new SqliteProductRepository(database);
    const memory = new InMemoryProductRepository();
    for (const department of ["Lima", "Cusco", "Arequipa", "constructor"]) {
      expect(plain(await sqlite.findFixedDepositsByDepartment(department)))
        .toEqual(plain(await memory.findFixedDepositsByDepartment(department)));
    }
    database.close();
  });

  it("cuentas de ahorro = data/cuentas.json (salvo la cobertura FSD, que en SQLite viene de la entidad)", () => {
    const database = openDatabase(":memory:");
    const sinFsd = (cuentas: CuentaAhorros[]) => plain(cuentas.map(({ coberturaFSD: _fsd, ...resto }) => resto));
    const sqlite = new RepositorioCuentasSqlite(database).obtenerTodas();
    expect(sinFsd(sqlite)).toEqual(sinFsd(new RepositorioCuentas().obtenerTodas()));
    // US09/US11: savings_accounts.entity_id -> financial_entities.fsd_coverage
    const fsdEntidad = database.prepare("SELECT s.id, e.fsd_coverage FROM savings_accounts s JOIN financial_entities e ON e.id = s.entity_id ORDER BY s.id")
      .all().map((fila) => validarCoberturaFSD(JSON.parse(String(fila.fsd_coverage))));
    expect(sqlite.map((cuenta) => cuenta.coberturaFSD)).toEqual(fsdEntidad);
    database.close();
  });

  it("perfiles SBS e informes del economista = data/sbs.json y data/informes.json", () => {
    const database = openDatabase(":memory:");
    const sbsSqlite = new SqliteSbsRiskRepository(database);
    const sbsJson = new JsonSbsRiskRepository();
    const reportsSqlite = new SqliteEconomistReportRepository(database);
    const reportsJson = new JsonEconomistReportRepository();
    for (const entityId of [1, 2, 3, 4, 5, 6, 999]) {
      expect(plain(sbsSqlite.findByEntityId(entityId))).toEqual(plain(sbsJson.findByEntityId(entityId)));
      expect(plain(reportsSqlite.findByEntityId(entityId))).toEqual(plain(reportsJson.findByEntityId(entityId)));
    }
    database.close();
  });
});

describe("SqlitePerfilRepository (US16 sobre la tabla users)", () => {
  function setup() {
    const file = tempFile();
    const users = new SqliteUserRepository(file);
    const database = openDatabase(file);
    const ana = users.create({ username: "ana", email: "ana@example.com", passwordHash: "x", plan: "BASICO", createdAt: new Date().toISOString() });
    const beto = users.create({ username: "beto", email: "beto@example.com", passwordHash: "x", plan: "BASICO", createdAt: new Date().toISOString() });
    return { users, database, perfiles: new SqlitePerfilRepository(database), ana, beto };
  }

  it("busca, detecta correos en uso y guarda en users", () => {
    const { users, database, perfiles, ana, beto } = setup();
    try {
      expect(perfiles.buscarPorId(String(ana.id))).toMatchObject({ id: String(ana.id), nombre: "ana", correo: "ana@example.com" });
      expect(perfiles.buscarPorId("usuario-demo")).toBeUndefined();
      expect(perfiles.buscarPorId("999")).toBeUndefined();
      expect(perfiles.correoEnUso("BETO@example.com", String(ana.id))).toBe(true);
      expect(perfiles.correoEnUso("ana@example.com", String(ana.id))).toBe(false);
      perfiles.guardar({ id: String(beto.id), nombre: "Beto Q", correo: "beto.q@example.com" });
      expect(users.findById(beto.id)).toMatchObject({ username: "Beto Q", email: "beto.q@example.com" });
    } finally { database.close(); users.close(); }
  });

  it("GET/PUT /api/perfil usan el usuario de la sesión", async () => {
    const { users, database, perfiles } = setup();
    const server = createApp(new InMemoryProductRepository(), users, undefined, undefined, perfiles).listen(0);
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    try {
      const registered = await fetch(`${base}/users/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "carla", email: "carla@example.com", password: "Clave-segura-1" }),
      });
      expect(registered.status).toBe(201);
      const session = (await (await fetch(`${base}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "carla@example.com", password: "Clave-segura-1" }),
      })).json()).session;
      const auth = { Authorization: `Bearer ${session.tokenJwt}` };

      const perfil = await fetch(`${base}/perfil`, { headers: auth });
      expect(perfil.status).toBe(200);
      expect(await perfil.json()).toMatchObject({ nombre: "carla", correo: "carla@example.com" });

      const duplicado = await fetch(`${base}/perfil`, {
        method: "PUT", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: "Carla", correo: "ana@example.com" }),
      });
      expect(duplicado.status).toBe(409);
      expect(await duplicado.json()).toEqual({
        message: "El correo ingresado ya está en uso por otra cuenta.",
      });
      expect(users.findById(session.userId)).toMatchObject({
        username: "carla",
        email: "carla@example.com",
      });

      const actualizado = await fetch(`${base}/perfil`, {
        method: "PUT", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: "carla", correo: "carla.r@example.com" }),
      });
      expect(actualizado.status).toBe(200);
      expect(await actualizado.json()).toMatchObject({
        nombre: "carla",
        correo: "carla.r@example.com",
      });
      expect(users.findById(session.userId)).toMatchObject({ username: "carla", email: "carla.r@example.com" });
      const perfilActualizado = await fetch(`${base}/perfil`, { headers: auth });
      expect(await perfilActualizado.json()).toMatchObject({
        nombre: "carla",
        correo: "carla.r@example.com",
      });
      const accesoConCorreoNuevo = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "carla.r@example.com", password: "Clave-segura-1" }),
      });
      expect(accesoConCorreoNuevo.status).toBe(200);
      const accesoConCorreoAnterior = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "carla@example.com", password: "Clave-segura-1" }),
      });
      expect(accesoConCorreoAnterior.status).toBe(401);

      // Sin sesión no se expone ningún perfil real: se pide iniciar sesión
      const anonimo = await fetch(`${base}/perfil`);
      expect(anonimo.status).toBe(401);
      expect(await anonimo.json()).toEqual({ message: "Inicia sesión para ver y editar tu perfil." });
      expect((await fetch(`${base}/perfil`, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: "X", correo: "x@example.com" }) })).status).toBe(401);
    } finally {
      server.close();
      database.close();
      users.close();
    }
  });
});
