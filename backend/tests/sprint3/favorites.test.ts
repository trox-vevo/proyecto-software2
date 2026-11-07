import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { FavoriteService } from "../../src/favorites/application/FavoriteService";
import { SqliteFavoriteRepository } from "../../src/favorites/infrastructure/SqliteFavoriteRepository";
import { FavoriteError, type AuthenticatedUser } from "../../src/favorites/domain/Favorite";
import { CuentaAhorros } from "../../src/rentabilidad/CuentaAhorros";
import { FixedDepositSimulationService } from "../../src/simulation/application/FixedDepositSimulationService";
import { FinancialProduct } from "../../src/simulation/domain/FinancialProduct";
import { ServiceChannels } from "../../src/simulation/domain/ServiceChannels";

const directory = mkdtempSync(join(tmpdir(), "yupay-favorites-"));
const file = join(directory, "users.sqlite");
// Fixture de usuarios compatible con la tabla de registro. No constituye autenticación.
const fixture = new DatabaseSync(file);
fixture.exec("CREATE TABLE users (id INTEGER PRIMARY KEY)");
fixture.exec("INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES; INSERT INTO users DEFAULT VALUES;");
fixture.close();
const repository = new SqliteFavoriteRepository(file);
const channels = new ServiceChannels(true, false);
const accounts = { obtenerTodas: () => [new CuentaAhorros("A", "Prueba", "1000", "0.05", new Date("2024-01-01"), "0", channels)] };
const products = { findFixedDepositsByDepartment: async (department: string) => department === "Lima" ? [new FinancialProduct(1, "Entidad de prueba", new Decimal("0.05"), new Decimal("500"), channels)] : [] };
const simulation = new FixedDepositSimulationService(products);
const service = new FavoriteService(repository, accounts, simulation);
const users = new Map<string, AuthenticatedUser>([
  ["Bearer test-pro-a", { id: 1, plan: "PRO" }],
  ["Bearer test-pro-b", { id: 2, plan: "PRO" }],
  ["Bearer test-basic", { id: 3, plan: "BASICO" }],
]);
let server: Server;
let endpoint: string;

beforeAll(async () => {
  server = createApp(products, {
    favoriteService: service,
    resolveUser: async (request) => users.get(request.headers.authorization ?? "") ?? null,
  }).listen(0);
  await once(server, "listening");
  endpoint = `http://localhost:${(server.address() as AddressInfo).port}/api/favorites`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  repository.close();
  rmSync(directory, { recursive: true, force: true });
});

const post = (body: unknown, authorization?: string) => fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
  body: JSON.stringify(body),
});
const savings = { instrument: "AHORROS", accountId: "A", days: 365 };

describe("US28, autorización y asociación de favoritos", () => {
  it("rechaza al visitante aunque envíe identidad y plan Pro en el cuerpo o las cabeceras", async () => {
    expect((await post({ ...savings, userId: 1, plan: "PRO" })).status).toBe(401);
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-User-Id": "1", "X-Plan": "PRO" }, body: JSON.stringify(savings) });
    expect(response.status).toBe(401);
  });
  it("rechaza al usuario Básico", async () => {
    const response = await post(savings, "Bearer test-basic");
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("PRO_REQUIRED");
  });
  it("guarda una instantánea calculada en servidor para el usuario Pro", async () => {
    const response = await post(savings, "Bearer test-pro-a");
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.created).toBe(true);
    expect(result.favorite.userId).toBe(1);
    expect(Number.isSafeInteger(result.favorite.id)).toBe(true);
    expect(result.favorite.id).toBeGreaterThan(0);
    expect(result.favorite.snapshot).toMatchObject({ cuentaId: "A", capitalInicial: "1,000.00", saldoFinal: "1,050.00" });
    expect(result.favorite.parameters).toEqual(savings);
    expect(result.favorite.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
  it("un reintento devuelve el mismo favorito y otro usuario obtiene uno propio", async () => {
    const first = await (await post(savings, "Bearer test-pro-a")).json();
    const repeated = await post(savings, "Bearer test-pro-a");
    expect(repeated.status).toBe(200);
    expect((await repeated.json()).favorite.id).toBe(first.favorite.id);
    const other = await post(savings, "Bearer test-pro-b");
    expect(other.status).toBe(201);
    const result = await other.json();
    expect(result.favorite.userId).toBe(2);
    expect(result.favorite.id).not.toBe(first.favorite.id);
  });
  it("seis solicitudes simultáneas producen una sola inserción", async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, () => post({ ...savings, days: 180 }, "Bearer test-pro-a")));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 200, 200, 200, 200, 201]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(new Set(bodies.map((body) => body.favorite.id)).size).toBe(1);
  });
  it("la autorización también se aplica al servicio llamado directamente", async () => {
    await expect(service.save(null, savings)).rejects.toMatchObject({ status: 401 });
    await expect(service.save({ id: 3, plan: "BASICO" }, savings)).rejects.toMatchObject({ status: 403 });
  });
  it("conserva el favorito después de cerrar y reabrir el repositorio", async () => {
    const reopened = new SqliteFavoriteRepository(file);
    const initial = await service.save({ id: 1, plan: "PRO" }, { ...savings, days: 90 });
    const secondService = new FavoriteService(reopened, accounts, simulation);
    try {
      const repeated = await secondService.save({ id: 1, plan: "PRO" }, { ...savings, days: 90 });
      expect(repeated.created).toBe(false);
      expect(repeated.favorite).toEqual(initial.favorite);
    } finally { reopened.close(); }
    const third = new SqliteFavoriteRepository(file);
    try {
      const repeated = await new FavoriteService(third, accounts, simulation).save({ id: 1, plan: "PRO" }, { ...savings, days: 90 });
      expect(repeated.favorite.id).toBe(initial.favorite.id);
    } finally { third.close(); }
  });
});

describe("US28, validación y reutilización de simuladores", () => {
  it.each([
    null, [], {}, { ...savings, days: 0 }, { ...savings, days: "365" },
    { ...savings, days: 1.5 }, { ...savings, accountId: " " },
    { ...savings, userId: 2 }, { ...savings, snapshot: { saldoFinal: "999999" } },
    { instrument: "PLAZO_FIJO", productId: 1, amount: "mil" },
  ])("rechaza datos inválidos sin confiar en valores calculados del cliente %j", async (body) => {
    expect((await post(body, "Bearer test-pro-a")).status).toBe(400);
  });
  it("rechaza una cuenta inexistente", async () => {
    expect((await post({ ...savings, accountId: "desconocida" }, "Bearer test-pro-a")).status).toBe(404);
  });
  it("guarda plazo fijo y normaliza montos equivalentes para evitar duplicados", async () => {
    const input = { instrument: "PLAZO_FIJO", productId: 1, amount: "1000", termDays: 360, department: "Lima", paymentMode: "AT_MATURITY" };
    const response = await post(input, "Bearer test-pro-a");
    expect(response.status).toBe(201);
    const first = await response.json();
    expect(first.favorite.snapshot).toMatchObject({ productId: 1, totalInterest: "50" });
    const repeated = await post({ ...input, amount: "1000.00" }, "Bearer test-pro-a");
    expect(repeated.status).toBe(200);
    expect((await repeated.json()).favorite.id).toBe(first.favorite.id);
    expect((await post({ ...input, paymentMode: "MONTHLY" }, "Bearer test-pro-a")).status).toBe(201);
    expect((await post({ ...input, termDays: 200 }, "Bearer test-pro-a")).status).toBe(400);
    expect((await post({ ...input, amount: "499" }, "Bearer test-pro-a")).status).toBe(400);
    expect((await post({ ...input, productId: 99 }, "Bearer test-pro-a")).status).toBe(404);
  });
  it("expone la dependencia de usuarios sin crear cuentas artificiales", async () => {
    const missingUsers = new SqliteFavoriteRepository(":memory:");
    try {
      await expect(new FavoriteService(missingUsers, accounts, simulation).save({ id: 1, plan: "PRO" }, savings)).rejects.toMatchObject({ status: 503, code: "USER_PERSISTENCE_REQUIRED" });
      await expect(service.save({ id: 999, plan: "PRO" }, savings)).rejects.toBeInstanceOf(FavoriteError);
    } finally { missingUsers.close(); }
  });
  it("mantiene la clave foránea y la unicidad en la base de datos", () => {
    const database = new DatabaseSync(file);
    try {
      const foreignKeys = database.prepare("PRAGMA foreign_key_list(favorite_simulations)").all();
      expect(foreignKeys).toEqual(expect.arrayContaining([expect.objectContaining({ table: "users", from: "user_id", to: "id" })]));
      const duplicateGroups = database.prepare("SELECT user_id, fingerprint FROM favorite_simulations GROUP BY user_id, fingerprint HAVING COUNT(*) > 1").all();
      expect(duplicateGroups).toEqual([]);
    } finally { database.close(); }
  });
  it("mantiene la gestión de favoritos reservada a US29", async () => {
    expect((await fetch(endpoint)).status).toBe(404);
    expect((await fetch(endpoint + "/otro", { method: "DELETE" })).status).toBe(404);
  });
});
