import { once } from "node:events";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import type { AddressInfo } from "node:net";
import { DatabaseSync } from "node:sqlite";
import jwt from "jsonwebtoken";
import { expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";
import { SqliteFavoriteRepository } from "../../src/favorites/infrastructure/SqliteFavoriteRepository";
import { createFavoriteUserResolver } from "../../src/favorites/infrastructure/createFavoriteUserResolver";
import { assertNumericDatabase } from "../../src/favorites/infrastructure/assertNumericDatabase";
import { FavoriteService } from "../../src/favorites/application/FavoriteService";
import { RepositorioCuentas } from "../../src/repositorio/RepositorioCuentas";
import { InMemoryProductRepository } from "../../src/simulation/infrastructure/InMemoryProductRepository";
import { FixedDepositSimulationService } from "../../src/simulation/application/FixedDepositSimulationService";

function cleanup(directory: string) {
  if (!realpathSync(directory).startsWith(realpathSync(tmpdir()) + sep)) throw new Error("Limpieza fuera del directorio temporal");
  rmSync(directory, { recursive: true, force: true });
}

it("integra JWT de main, plan persistido, favoritos idempotentes, recuperación y checkout sin elevar privilegios", async () => {
  const directory = mkdtempSync(join(tmpdir(), "yupay-main-sprint3-"));
  const file = join(directory, "users.sqlite");
  assertNumericDatabase(file);
  const users = new SqliteUserRepository(file);
  const favorites = new SqliteFavoriteRepository(file);
  const products = new InMemoryProductRepository();
  const accounts = new RepositorioCuentas();
  const sendRecoveryLink = vi.fn(async (_destination: string, _link: string) => true);
  const server = createApp(products, users, users, { sendRecoveryLink }, undefined, {
    resolveUser: createFavoriteUserResolver(users),
    favoriteService: new FavoriteService(favorites, accounts, new FixedDepositSimulationService(products)),
  }).listen(0);
  try {
    await once(server, "listening");
    const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
    const post = (route: string, body: unknown, token?: string, extraHeaders = {}) => fetch(base + route, {
      method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
      body: JSON.stringify(body),
    });
    const input = { username: "Integración", email: "basic@example.com", password: "Clave-segura-123" };
    const registered = await post("/users/register", input);
    expect(registered.status).toBe(201);
    const basic = (await registered.json()).user;
    expect(Number.isSafeInteger(basic.id) && basic.id > 0).toBe(true);
    expect(basic.plan).toBe("BASICO");
    expect((await post("/users/register", { ...input, email: " BASIC@EXAMPLE.COM " })).status).toBe(409);
    const pro = users.create({ username: "Pro", email: "pro@example.com", plan: "PRO",
      passwordHash: users.findByEmail(input.email)!.passwordHash, createdAt: new Date().toISOString() });
    const login = async (email: string, password = input.password) => {
      const response = await post("/auth/login", { email, password });
      expect(response.status).toBe(200);
      return (await response.json()).session;
    };
    const basicSession = await login(input.email);
    const proSession = await login(pro.email);
    expect(proSession.userId).toBe(pro.id);
    expect(jwt.verify(proSession.tokenJwt, getJwtSecret())).toMatchObject({ sub: String(pro.id) });
    const parameters = { instrument: "AHORROS", accountId: accounts.obtenerTodas()[0].id, days: 365 };
    expect((await post("/favorites", parameters, undefined, { "X-User-Id": String(pro.id), "X-Plan": "PRO" })).status).toBe(401);
    expect((await post("/favorites", parameters, "invalid")).status).toBe(401);
    expect((await post("/favorites", parameters, jwt.sign({ sub: "999999" }, getJwtSecret()))).status).toBe(401);
    expect((await post("/favorites", parameters, jwt.sign({ sub: String(pro.id) }, getJwtSecret(), { expiresIn: -1 }))).status).toBe(401);
    expect((await post("/favorites", parameters, basicSession.tokenJwt)).status).toBe(403);
    const fakePlan = jwt.sign({ sub: String(basic.id), plan: "PRO" }, getJwtSecret());
    expect((await post("/favorites", { ...parameters, userId: pro.id, plan: "PRO" }, fakePlan)).status).toBe(403);
    const saved = await post("/favorites", parameters, proSession.tokenJwt);
    expect(saved.status).toBe(201);
    const { favorite } = await saved.json();
    expect(favorite.userId).toBe(pro.id);
    expect(Number.isSafeInteger(favorite.id) && favorite.id > 0).toBe(true);
    const repeated = await post("/favorites", parameters, proSession.tokenJwt);
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ created: false, favorite: { id: favorite.id, userId: pro.id } });
    const database = new DatabaseSync(file);
    try {
      database.prepare("UPDATE users SET plan = 'BASICO' WHERE id = ?").run(pro.id);
      expect((await post("/favorites", parameters, proSession.tokenJwt)).status).toBe(403);
      database.prepare("UPDATE users SET plan = 'PRO' WHERE id = ?").run(pro.id);
      expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { database.close(); }
    const payment = await post("/checkout/simulate", { planId: "PRO", scenarioId: "DEMO_APPROVED",
      billing: { name: "Persona ficticia", email: input.email } }, basicSession.tokenJwt);
    expect(payment.status).toBe(200);
    expect(await payment.json()).toMatchObject({ outcome: "APPROVED", simulation: true });
    expect(users.findById(basic.id)?.plan).toBe("BASICO");
    expect((await post("/favorites", parameters, basicSession.tokenJwt)).status).toBe(403);
    expect((await post("/auth/forgot-password", { email: pro.email })).status).toBe(202);
    const token = new URL(sendRecoveryLink.mock.calls[0][1]).searchParams.get("token");
    expect((await post("/auth/reset-password", { token, newPassword: "Nueva-clave-456" })).status).toBe(200);
    expect((await post("/auth/login", { email: pro.email, password: input.password })).status).toBe(401);
    const recovered = await login(pro.email, "Nueva-clave-456");
    expect(recovered.userId).toBe(pro.id);
    expect((await post("/favorites", parameters, recovered.tokenJwt)).status).toBe(200);
    expect((await post("/auth/reset-password", { token, newPassword: "Otra-clave-789" })).status).toBe(400);
    expect((await fetch(base + "/perfil")).status).toBe(200);
    expect((await fetch(base + "/plans")).status).toBe(200);
    assertNumericDatabase(file);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    favorites.close();
    users.close();
    cleanup(directory);
  }
});
