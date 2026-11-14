import Decimal from "decimal.js";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import type { User, UserPlan } from "../../src/registration/domain/User";
import type { UserRepository } from "../../src/registration/domain/UserRepository";
import { FinancialProduct } from "../../src/simulation/domain/FinancialProduct";
import { ServiceChannels } from "../../src/simulation/domain/ServiceChannels";

// US25 (TS-80): flujo completo con la app real. Los productos 1 y 4 existen en data/sbs.json
// (A+ y C); el 99 no tiene datos de la SBS.
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
const product = (id: number, tea: string) =>
  new FinancialProduct(id, `Entidad ${id}`, new Decimal(tea), new Decimal("500"), new ServiceChannels(true, true));
const products = [product(1, "0.05"), product(4, "0.06"), product(99, "0.04")];
const tokenFor = (id: number) => jwt.sign({ sub: String(id) }, getJwtSecret());

let server: Server;
let baseUrl: string;

const simular = async (token?: string) => {
  const response = await fetch(`${baseUrl}/api/simulations/fixed-deposits`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ amount: "1000", termDays: 360, department: "Lima", paymentMode: "AT_MATURITY" }),
  });
  expect(response.status).toBe(200);
  const results = (await response.json()) as { productId: number; riskRating: string | null }[];
  return Object.fromEntries(results.map((r) => [r.productId, r.riskRating]));
};

beforeAll(async () => {
  server = createApp({ findFixedDepositsByDepartment: async () => products }, repository).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

describe("US25, calificación de riesgo en POST /api/simulations/fixed-deposits", () => {
  it("un usuario Pro recibe la calificación de la SBS de cada entidad", async () => {
    expect(await simular(tokenFor(2))).toEqual({ 1: "A+", 4: "C", 99: null });
  });

  it("un usuario Básico no la recibe (la oculta la US27)", async () => {
    expect(await simular(tokenFor(1))).toEqual({ 1: null, 4: null, 99: null });
  });

  it("sin sesión tampoco", async () => {
    expect(await simular()).toEqual({ 1: null, 4: null, 99: null });
  });
});
