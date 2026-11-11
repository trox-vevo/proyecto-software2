import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import type { PaymentGateway, PaymentResult } from "../../src/checkout/PaymentGateway";
import { AuthenticationRequiredError, PaymentProcessingService } from "../../src/checkout/PaymentProcessingService";
import type { User } from "../../src/registration/domain/User";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";

// US33 (TS-101, TS-102): activación del Plan Pro tras un pago aprobado.
const NOW = new Date("2026-11-10T12:00:00.000Z");
const IN_30_DAYS = "2026-12-10T12:00:00.000Z";
const request = { planId: "PRO", scenarioId: "DEMO_APPROVED", billing: { name: "Persona", email: "demo@example.com" } };

const basicUser: User = {
  id: 7, username: "basico", email: "basico@prueba.com", passwordHash: "scrypt$00$00",
  plan: "BASICO", createdAt: "2026-11-01T00:00:00.000Z", planExpiresAt: null,
};
const gatewayReturning = (outcome: PaymentResult["outcome"]): PaymentGateway => ({
  simulate: vi.fn(() => ({
    reference: "DEMO-0123456789abcdef01234567", outcome, message: "ok", occurredAt: NOW.toISOString(),
    declineReason: outcome === "APPROVED" ? null : "Fondos ficticios insuficientes.",
  })),
});
const repositoryWith = (user: User | null) => ({ findById: vi.fn(() => user), activatePro: vi.fn() });

describe("US33, PaymentProcessingService", () => {
  it("Escenario 1: un pago aprobado activa PRO por 30 días", () => {
    const users = repositoryWith(basicUser);
    const service = new PaymentProcessingService(gatewayReturning("APPROVED"), users, () => new Date(NOW));
    const result = service.processPayment(7, request);
    expect(users.activatePro).toHaveBeenCalledOnce();
    expect(users.activatePro).toHaveBeenCalledWith(7, IN_30_DAYS);
    expect(result).toMatchObject({ outcome: "APPROVED", plan: "PRO", planExpiresAt: IN_30_DAYS });
  });

  it("Escenario 2: un pago rechazado no cambia el plan ni la fecha", () => {
    const users = repositoryWith(basicUser);
    const result = new PaymentProcessingService(gatewayReturning("DECLINED"), users).processPayment(7, request);
    expect(users.activatePro).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: "DECLINED", plan: "BASICO", planExpiresAt: null, declineReason: "Fondos ficticios insuficientes." });
  });

  it.each([[undefined], [99]])("sin un usuario válido (%s) no llama a la pasarela", (userId) => {
    const gateway = gatewayReturning("APPROVED");
    const users = repositoryWith(null);
    expect(() => new PaymentProcessingService(gateway, users).processPayment(userId, request)).toThrow(AuthenticationRequiredError);
    expect(gateway.simulate).not.toHaveBeenCalled();
    expect(users.activatePro).not.toHaveBeenCalled();
  });
});

describe("US33, SqliteUserRepository.activatePro", () => {
  it("guarda PRO y la fecha de vencimiento; los usuarios nuevos empiezan sin fecha", () => {
    const users = new SqliteUserRepository(":memory:");
    const created = users.create({ username: "u", email: "u@prueba.com", passwordHash: "h", plan: "BASICO", createdAt: NOW.toISOString() });
    expect(users.findById(created.id)?.planExpiresAt).toBeNull();
    users.activatePro(created.id, IN_30_DAYS);
    expect(users.findById(created.id)).toMatchObject({ plan: "PRO", planExpiresAt: IN_30_DAYS });
    expect(() => users.activatePro(999, IN_30_DAYS)).toThrow();
    users.close();
  });

  it("agrega plan_expires_at a una base creada antes de la US33", () => {
    const directory = mkdtempSync(join(tmpdir(), "yupay-us33-"));
    const file = join(directory, "users.sqlite");
    try {
      const old = new DatabaseSync(file);
      old.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'BASICO', created_at TEXT NOT NULL)`);
      old.exec("INSERT INTO users (username, email, password_hash, created_at) VALUES ('a', 'a@prueba.com', 'h', '2026-01-01T00:00:00.000Z')");
      old.close();
      const users = new SqliteUserRepository(file);
      expect(users.findById(1)).toMatchObject({ plan: "BASICO", planExpiresAt: null });
      users.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});

describe("US33, POST /api/checkout/simulate con la app real", () => {
  let server: Server;
  let baseUrl: string;
  const users = new SqliteUserRepository(":memory:");
  const newBasic = (email: string) =>
    users.create({ username: "u", email, passwordHash: "h", plan: "BASICO", createdAt: NOW.toISOString() }).id;
  const tokenFor = (id: number) => jwt.sign({ sub: String(id) }, getJwtSecret());
  const pay = (scenarioId: string, token?: string) => fetch(`${baseUrl}/api/checkout/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...request, scenarioId }),
  });

  beforeAll(async () => {
    server = createApp({ findFixedDepositsByDepartment: async () => [] }, users).listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    users.close();
  });

  it("sin sesión responde 401 sin códigos técnicos para el usuario", async () => {
    const response = await pay("DEMO_APPROVED");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "AUTHENTICATION_REQUIRED", message: "Inicia sesión para suscribirte al Plan Pro." });
  });

  it("un Básico que paga con aprobación queda PRO y pasa el bloqueo de la US27", async () => {
    const id = newBasic("aprobado@prueba.com");
    const riskReport = () => fetch(`${baseUrl}/api/risk-reports/1`, { headers: { Authorization: `Bearer ${tokenFor(id)}` } });
    expect((await riskReport()).status).toBe(403);
    const response = await pay("DEMO_APPROVED", tokenFor(id));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ outcome: "APPROVED", plan: "PRO", planExpiresAt: expect.any(String) });
    expect(users.findById(id)).toMatchObject({ plan: "PRO", planExpiresAt: body.planExpiresAt });
    expect((await riskReport()).status).not.toBe(403);
  });

  it("un Básico con pago rechazado sigue BASICO", async () => {
    const id = newBasic("rechazado@prueba.com");
    const response = await pay("DEMO_DECLINED", tokenFor(id));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "DECLINED", plan: "BASICO", planExpiresAt: null });
    expect(users.findById(id)).toMatchObject({ plan: "BASICO", planExpiresAt: null });
  });
});
