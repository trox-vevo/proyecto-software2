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

// US30 (TS-94, TS-95): app real en un puerto libre, como tests/auth/ProAccess.test.ts.
const user = (id: number, plan: UserPlan): User => ({
  id, username: `usuario${id}`, email: `usuario${id}@prueba.com`, passwordHash: "scrypt$00$00",
  plan, createdAt: "2026-11-11T00:00:00.000Z", planExpiresAt: null,
});
const users = [user(1, "BASICO"), user(2, "PRO")];
const repository: UserRepository = {
  findByEmail: (email) => users.find((u) => u.email === email) ?? null,
  findById: (id) => users.find((u) => u.id === id) ?? null,
  create: () => { throw new Error("no se usa en estas pruebas"); },
  activatePro: () => { throw new Error("no se usa en estas pruebas"); },
  requestProCancellation: () => { throw new Error("no se usa en estas pruebas"); },
};
const products = [new FinancialProduct(1, "Entidad de prueba", new Decimal("0.05"), new Decimal("500"), new ServiceChannels(true, false))];
const valid = { amount: "1000", termDays: 360, department: "Lima", paymentMode: "AT_MATURITY" };
const tokenFor = (id: number) => jwt.sign({ sub: String(id) }, getJwtSecret());

let server: Server;
let baseUrl: string;
const download = (body: unknown, token?: string) => fetch(`${baseUrl}/api/reports/solvency`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const expectPdf = async (response: Response) => {
  expect(response.status).toBe(200);
  const pdf = Buffer.from(await response.arrayBuffer());
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
};

beforeAll(async () => {
  server = createApp({ findFixedDepositsByDepartment: async () => products }, repository).listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

describe("US30, POST /api/reports/solvency", () => {
  it("401 sin sesión", async () => {
    expect((await download(valid)).status).toBe(401);
  });

  it("403 para un usuario Básico", async () => {
    const response = await download(valid, tokenFor(1));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Exclusivo Plan Pro" });
  });

  it("un usuario Pro descarga ReporteSolvencia.pdf", async () => {
    const response = await download(valid, tokenFor(2));
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain('filename="ReporteSolvencia.pdf"');
    await expectPdf(response);
  });

  it.each([
    { ...valid, amount: 100 }, { ...valid, amount: "1000.555" }, { ...valid, termDays: "360" },
    { ...valid, department: 5 }, { ...valid, paymentMode: "WEEKLY" }, {},
  ])("400 con un mensaje claro para un cuerpo inválido %j", async (body) => {
    const response = await download(body, tokenFor(2));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/^Datos de simulación inválidos/);
  });

  it("400 con el mensaje del servicio para un plazo no permitido", async () => {
    const response = await download({ ...valid, termDays: 200 }, tokenFor(2));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "El plazo debe ser de 180, 360, 540, 720, 900 o 1080 días." });
  });

  it("TS-95: 5 descargas simultáneas producen PDF válidos", async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => download(valid, tokenFor(2))));
    for (const response of responses) await expectPdf(response);
  });
});
