import express from "express";
import jwt from "jsonwebtoken";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import { CheckoutController } from "../../src/checkout/CheckoutController";
import { createCheckoutRouter } from "../../src/checkout/checkoutRoutes";
import { InvalidMockPaymentError, MockPaymentService } from "../../src/checkout/MockPaymentService";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";

const request = {
  planId: "PRO", scenarioId: "DEMO_APPROVED",
  billing: { name: "Persona de demostración", email: "demo@example.com" },
};
const service = new MockPaymentService();
const nativeFetch = globalThis.fetch;
let server: Server;
let origin: string;
// US33: el endpoint exige sesión. Un usuario real y un JWT de prueba firmado con el secreto de la app.
const users = new SqliteUserRepository(":memory:");
const payer = users.create({ username: "demo", email: "pagador@example.com", passwordHash: "h", plan: "BASICO", createdAt: new Date().toISOString() });
const token = jwt.sign({ sub: String(payer.id) }, getJwtSecret());
beforeAll(async () => {
  server = createApp({ findFixedDepositsByDepartment: async () => [] }, users).listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); users.close(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const post = (body: unknown) => nativeFetch(`${origin}/api/checkout/simulate`, {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
});

describe("US32, servicio de pasarela académica", () => {
  it.each([
    ["DEMO_APPROVED", "APPROVED", null],
    ["DEMO_DECLINED", "DECLINED", "Fondos ficticios insuficientes."],
  ])("produce %s sin importar un importe o activar membresía", (scenarioId, outcome, declineReason) => {
    const result = service.simulate({ ...request, scenarioId });
    expect(result).toMatchObject({ outcome, declineReason, environment: "DEMO", simulation: true, planId: "PRO", amount: null });
    expect(result.reference).toMatch(/^DEMO-[0-9a-f]{24}$/);
    expect(new Date(result.occurredAt).toISOString()).toBe(result.occurredAt);
    expect(result.message).toContain("demostración");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("subscription");
    expect(JSON.stringify(result)).not.toContain(request.billing.email);
    expect(JSON.stringify(result)).not.toContain(request.billing.name);
  });

  it("genera referencias distintas y no depende de llamadas de red", () => {
    const network = vi.fn(() => { throw new Error("Una pasarela externa no debe utilizarse"); });
    vi.stubGlobal("fetch", network);
    const first = service.simulate(request);
    const second = service.simulate(request);
    expect(first.reference).not.toBe(second.reference);
    expect(network).not.toHaveBeenCalled();
  });

  it.each([null, [], {}, { ...request, scenarioId: "APPROVED" }, { ...request, scenarioId: ["DEMO_APPROVED"] }, { ...request, billing: {} }])(
    "también valida solicitudes cuando se llama directamente %j", (input) => {
      expect(() => service.simulate(input)).toThrow(InvalidMockPaymentError);
    },
  );
});

describe("US32, endpoint local de simulación", () => {
  it.each(["DEMO_APPROVED", "DEMO_DECLINED"])("responde HTTP 200 para el escenario válido %s", async (scenarioId) => {
    const response = await post({ ...request, scenarioId });
    expect(response.status).toBe(200);
    // plan y planExpiresAt (US33) dependen del historial del pagador; los cubre tests/checkout.
    const { plan, planExpiresAt, ...result } = await response.json();
    expect(["BASICO", "PRO"]).toContain(plan);
    expect(planExpiresAt === null || typeof planExpiresAt === "string").toBe(true);
    expect(result).toEqual({
      reference: expect.stringMatching(/^DEMO-[0-9a-f]{24}$/),
      outcome: scenarioId === "DEMO_APPROVED" ? "APPROVED" : "DECLINED",
      simulation: true, environment: "DEMO", occurredAt: expect.any(String), planId: "PRO", amount: null,
      message: expect.stringContaining("demostración"),
      declineReason: scenarioId === "DEMO_APPROVED" ? null : "Fondos ficticios insuficientes.",
    });
  });

  it.each([
    {}, [], { ...request, planId: "BASICO" }, { ...request, planId: 1 },
    { ...request, scenarioId: "UNKNOWN" }, { ...request, scenarioId: null },
    { ...request, billing: null }, { ...request, billing: { name: "", email: "incorrecto" } },
    { ...request, amount: "99" }, { ...request, userId: 1 }, { ...request, approve: true },
  ])("rechaza solicitudes fuera del contrato %j", async (body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_DEMO_PAYMENT", environment: "DEMO", simulation: true });
  });

  it.each(["cardNumber", "pan", "cvv", "cvc", "expiry", "paymentMethodToken"])("rechaza %s en cualquier nivel sin eco ni logs", async (field) => {
    const marker = "DATO-FICTICIO-NO-REGISTRAR";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const infoLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const top = await post({ ...request, [field]: marker });
    const nested = await post({ ...request, billing: { ...request.billing, [field]: marker } });
    for (const response of [top, nested]) {
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain(marker);
    }
    expect(errorLog).not.toHaveBeenCalled();
    expect(infoLog).not.toHaveBeenCalled();
  });

  it("valida localmente sin registrar facturación ni ejecutar una llamada externa", async () => {
    const network = vi.fn(() => { throw new Error("No se permite red externa"); });
    vi.stubGlobal("fetch", network);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const infoLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await post(request);
    expect(response.status).toBe(200);
    expect(await response.text()).not.toMatch(/demo@example.com|Persona de demostración/);
    expect(network).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(infoLog).not.toHaveBeenCalled();
  });

  it("un error inesperado produce 503 sin registrar ni reflejar su contenido", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const infoLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
    app.use("/api/checkout", createCheckoutRouter(new CheckoutController({ processPayment: () => { throw new Error("CONTENIDO-PRIVADO-DE-PRUEBA"); } })));
    const isolated = app.listen(0, "127.0.0.1");
    await once(isolated, "listening");
    try {
      const response = await nativeFetch(`http://127.0.0.1:${(isolated.address() as AddressInfo).port}/api/checkout/simulate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
      });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        code: "DEMO_PAYMENT_UNAVAILABLE", message: "No se pudo procesar la simulación. Inténtalo nuevamente.",
        simulation: true, environment: "DEMO",
      });
      expect(errorLog).not.toHaveBeenCalled();
      expect(infoLog).not.toHaveBeenCalled();
    } finally { await new Promise<void>((resolve) => isolated.close(() => resolve())); }
  });
});
