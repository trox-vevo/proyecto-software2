import { once } from "node:events";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";

function cleanup(directory: string) {
  const parent = realpathSync(tmpdir()) + sep;
  if (!realpathSync(directory).startsWith(parent)) throw new Error("Limpieza fuera del directorio temporal");
  rmSync(directory, { recursive: true, force: true });
}

it("integra registro US01/US02, reapertura SQLite, login y recuperación con una misma identidad numérica", async () => {
  const directory = mkdtempSync(join(tmpdir(), "yupay-registration-auth-"));
  const path = join(directory, "users.sqlite");
  let users = new SqliteUserRepository(path);
  const sendRecoveryLink = vi.fn(async (_destination: string, _link: string) => true);
  const start = () => createApp({ findFixedDepositsByDepartment: async () => [] }, users, users, { sendRecoveryLink }).listen(0);
  let server = start();
  let base: string;
  const post = (route: string, body: unknown) => fetch(`${base}${route}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  try {
    await once(server, "listening");
    base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
    const input = { username: "Integración", email: "integracion@example.com", password: "Clave-segura-123" };
    const registered = await post("/users/register", input);
    expect(registered.status).toBe(201);
    const { user } = await registered.json();
    expect(Number.isSafeInteger(user.id) && user.id > 0).toBe(true);
    expect(user.plan).toBe("BASICO");
    expect(user).not.toHaveProperty("passwordHash");
    const proUser = users.create({
      username: "Pro", email: "pro@example.com", plan: "PRO",
      passwordHash: users.findByEmail(input.email)!.passwordHash,
      createdAt: new Date().toISOString(),
    });
    await close();
    users.close();
    users = new SqliteUserRepository(path);
    server = start();
    await once(server, "listening");
    base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
    expect(users.findByEmail(input.email)?.id).toBe(user.id);
    expect((await post("/users/register", { ...input, email: " INTEGRACION@EXAMPLE.COM " })).status).toBe(409);
    const firstLogin = await post("/auth/login", input);
    expect(firstLogin.status).toBe(200);
    const { session } = await firstLogin.json();
    expect(session).toMatchObject({ userId: user.id, plan: "BASICO" });
    expect(typeof session.id).toBe("string");
    expect(jwt.verify(session.tokenJwt, getJwtSecret())).toMatchObject({ sub: String(user.id), email: input.email });
    const proLogin = await post("/auth/login", { email: proUser.email, password: input.password });
    expect(proLogin.status).toBe(200);
    expect(await proLogin.json()).toMatchObject({ plan: "PRO", session: { userId: proUser.id, plan: "PRO" } });
    expect((await post("/auth/forgot-password", { email: input.email })).status).toBe(202);
    const token = new URL(sendRecoveryLink.mock.calls[0][1]).searchParams.get("token");
    expect((await post("/auth/reset-password", { token, newPassword: "Nueva-clave-456" })).status).toBe(200);
    expect((await post("/auth/login", input)).status).toBe(401);
    const login = await post("/auth/login", { email: input.email, password: "Nueva-clave-456" });
    expect(login.status).toBe(200);
    expect((await login.json()).session.userId).toBe(user.id);
    expect((await post("/auth/reset-password", { token, newPassword: "Otra-clave-789" })).status).toBe(400);
  } finally {
    if (server.listening) await close();
    users.close();
    cleanup(directory);
  }
});
