import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import type { User, UserPlan } from "../../src/registration/domain/User";
import type { UserRepository } from "../../src/registration/domain/UserRepository";

// US26 (TS-83): GET /api/risk-reports/:entityId con la app real y los datos de data/
const user = (id: number, plan: UserPlan): User => ({
  id, username: `usuario${id}`, email: `usuario${id}@prueba.com`, passwordHash: "scrypt$00$00",
  plan, createdAt: "2026-11-13T00:00:00.000Z", planExpiresAt: null,
});
const users = [user(1, "BASICO"), user(2, "PRO")];
const repository: UserRepository = {
  findByEmail: (email) => users.find((u) => u.email === email) ?? null,
  findById: (id) => users.find((u) => u.id === id) ?? null,
  create: () => { throw new Error("no se usa en estas pruebas"); },
  activatePro: () => { throw new Error("no se usa en estas pruebas"); },
};
const tokenFor = (id: number) => jwt.sign({ sub: String(id) }, getJwtSecret());

let server: Server;
let baseUrl: string;
const get = (entityId: string, token?: string) =>
  fetch(`${baseUrl}/api/risk-reports/${entityId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

beforeAll(async () => {
  server = createApp({ findFixedDepositsByDepartment: async () => [] }, repository).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

describe("US26, GET /api/risk-reports/:entityId", () => {
  it("un usuario Pro recibe el informe con los indicadores de la SBS", async () => {
    const response = await get("1", tokenFor(2));

    expect(response.status).toBe(200);
    const report = await response.json();
    expect(report).toMatchObject({
      entityId: 1,
      entityName: "Entidad A",
      publishedAt: "2026-10-15",
      sbsProfile: { riskRating: "A+", capitalAdequacyRatio: "0.1620", reportDate: "2026-09-30" },
    });
    expect(report.strengths.length).toBeGreaterThan(0);
    expect(report.risks.length).toBeGreaterThan(0);
  });

  it("404 si la entidad no tiene informe", async () => {
    const response = await get("999", tokenFor(2));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Informe no disponible" });
  });

  it.each(["abc", "0", "-1", "1.5"])("400 si el entityId '%s' no es válido", async (entityId) => {
    expect((await get(entityId, tokenFor(2))).status).toBe(400);
  });

  it("un usuario Básico sigue bloqueado (403, US27)", async () => {
    expect((await get("1", tokenFor(1))).status).toBe(403);
  });

  it("sin sesión: 401 (US27)", async () => {
    expect((await get("1")).status).toBe(401);
  });
});
