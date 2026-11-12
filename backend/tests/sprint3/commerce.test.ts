import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";

let server: Server;
let url: string;
beforeAll(async () => {
  server = createApp({ findFixedDepositsByDepartment: async () => [] }).listen(0);
  await once(server, "listening");
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
const billing = { planId: "PRO", billing: { name: "Persona de prueba", email: "factura@example.com" } };
const post = (body: unknown) => fetch(`${url}/api/checkout/validate-billing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("US31, catálogo de planes", () => {
  it("devuelve Básico y Pro con precios pendientes y beneficios del backlog", async () => {
    const response = await fetch(`${url}/api/plans`);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.plans.map((plan: { id: string }) => plan.id)).toEqual(["BASICO", "PRO"]);
    for (const plan of result.plans) expect(plan.price).toBeNull();
    expect(result.plans[0].features.favorites).toBe(false);
    expect(result.plans[1].features.favorites).toBe(true);
    expect(result.features).toEqual(expect.arrayContaining([expect.objectContaining({ id: "favorites" })]));
  });
});

describe("US32, límites de captura segura", () => {
  it("declara la pasarela académica local sin pagos reales y con activación Pro (US33)", async () => {
    const response = await fetch(`${url}/api/checkout/config`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      environment: "DEMO", provider: "LOCAL_MOCK", simulation: true,
      cardCaptureAvailable: true, processingAvailable: true,
      realPaymentsAvailable: false, membershipActivationAvailable: true,
    });
  });
  it("valida facturación sin devolver datos personales ni confirmar pagos", async () => {
    const response = await post(billing);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({ status: "BILLING_VALIDATED", environment: "DEMO", simulation: true, handoff: { planId: "PRO", paymentMethodToken: null } });
    expect(result).not.toHaveProperty("blockers");
    expect(JSON.stringify(result)).not.toContain("factura@example.com");
    expect(result).not.toHaveProperty("subscription");
  });
  it.each([
    [], {}, { ...billing, planId: "BASICO" }, { ...billing, amount: "1" },
    { ...billing, billing: null }, { ...billing, billing: [] },
    { ...billing, billing: { name: "", email: "invalido" } },
    { ...billing, billing: { name: "x".repeat(121), email: "factura@example.com" } },
    { ...billing, billing: { name: "Persona", email: 123 } },
    { ...billing, billing: { ...billing.billing, unknown: true } },
  ])("rechaza facturación inválida %j", async (input) => {
    const response = await post(input);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_BILLING");
  });
  it("rechaza un cuerpo JSON null con el manejador existente de Express", async () => {
    const response = await post(null);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "El cuerpo de la petición no es un JSON válido." });
  });
  it.each(["cardNumber", "pan", "cvv", "cvc", "expiry", "paymentMethodToken"])("rechaza el campo sensible o ajeno %s sin reflejarlo ni registrarlo", async (field) => {
    const errorLog = vi.spyOn(console, "error");
    const infoLog = vi.spyOn(console, "log");
    const marker = "DATO-SENSIBLE-DE-PRUEBA";
    try {
      const response = await post({ ...billing, billing: { ...billing.billing, [field]: marker } });
      expect(response.status).toBe(400);
      expect(await response.text()).not.toContain(marker);
      expect(errorLog).not.toHaveBeenCalled();
      expect(infoLog).not.toHaveBeenCalled();
    } finally { errorLog.mockRestore(); infoLog.mockRestore(); }
  });
  it("el arranque sin autenticación falla de forma cerrada para favoritos", async () => {
    expect((await fetch(`${url}/api/favorites`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer inventado" }, body: JSON.stringify({ userId: "pro", plan: "PRO" }) })).status).toBe(401);
  });
  it("no expone un endpoint de cobro real", async () => {
    expect((await fetch(`${url}/api/checkout/pay`, { method: "POST" })).status).toBe(404);
  });
});
