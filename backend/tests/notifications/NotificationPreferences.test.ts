import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";

let server: Server;
let users: SqliteUserRepository;
let baseUrl: string;
let nextUser = 0;
const basicId = 1;

function tokenFor(userId: number) {
  return jwt.sign({ sub: String(userId) }, getJwtSecret());
}

async function createProUser(): Promise<number> {
  nextUser += 1;
  const user = users.create({
    username: `pro${nextUser}`,
    email: `pro${nextUser}@example.com`,
    passwordHash: "hash",
    plan: "BASICO",
    createdAt: new Date().toISOString(),
  });
  users.activatePro(user.id, new Date(Date.now() + 86_400_000).toISOString());
  return user.id;
}

function request(userId: number | undefined, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (userId !== undefined) headers.set("Authorization", `Bearer ${tokenFor(userId)}`);
  return fetch(`${baseUrl}/api/notifications/preferences`, { ...init, headers });
}

beforeAll(async () => {
  users = new SqliteUserRepository(":memory:");
  users.create({
    username: "basic",
    email: "basic@example.com",
    passwordHash: "hash",
    plan: "BASICO",
    createdAt: new Date().toISOString(),
  });
  server = createApp(
    { findFixedDepositsByDepartment: async () => [] },
    users,
  ).listen(0);
  await once(server, "listening");
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
  users.close();
});

describe("US37, preferencias de notificación", () => {
  it("exige autenticación", async () => {
    const response = await request(undefined);

    expect(response.status).toBe(401);
  });

  it("impide el acceso Básico con el mensaje informativo de upgrade", async () => {
    const response = await request(basicId);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: "Esta función está disponible solo para usuarios Pro. Actualiza tu plan para personalizar tus alertas.",
    });
  });

  it("guarda y recupera las preferencias del usuario Pro desde SQLite", async () => {
    const userId = await createProUser();
    const preferences = {
      alertTypes: ["CAMBIO_RIESGO"],
      frequency: "RESUMEN_DIARIO",
    };
    const saveResponse = await request(userId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    });

    expect(saveResponse.status).toBe(200);
    expect(await saveResponse.json()).toEqual(preferences);

    const readResponse = await request(userId);
    expect(readResponse.status).toBe(200);
    expect(await readResponse.json()).toEqual(preferences);
  });

  it("rechaza datos inválidos y conserva la configuración previamente guardada", async () => {
    const userId = await createProUser();
    const initial = {
      alertTypes: ["CAMBIO_TASA"],
      frequency: "INMEDIATA",
    };
    await request(userId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial),
    });

    const invalidResponse = await request(userId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertTypes: [], frequency: "CADA_HORA" }),
    });

    expect(invalidResponse.status).toBe(400);
    expect(await (await request(userId)).json()).toEqual(initial);
  });
});
