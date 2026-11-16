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
import { PaymentReceiptGenerator } from "../../src/checkout/PaymentReceiptGenerator";
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
const repositoryWith = (user: User | null) => ({ findById: vi.fn(() => user) });
const paymentHistoryWith = () => ({
  recordCheckoutAttempt: vi.fn(),
  recordApprovedCheckout: vi.fn(),
});

describe("US33, PaymentProcessingService", () => {
  it("Escenario 1: un pago aprobado activa PRO por 30 días", () => {
    const users = repositoryWith(basicUser);
    const history = paymentHistoryWith();
    const service = new PaymentProcessingService(gatewayReturning("APPROVED"), users, () => new Date(NOW), history);
    const result = service.processPayment(7, request);
    expect(history.recordApprovedCheckout).toHaveBeenCalledOnce();
    expect(history.recordApprovedCheckout).toHaveBeenCalledWith(7, IN_30_DAYS, expect.objectContaining({
      reference: "DEMO-0123456789abcdef01234567",
      outcome: "APPROVED",
    }));
    expect(result).toMatchObject({ outcome: "APPROVED", plan: "PRO", planExpiresAt: IN_30_DAYS });
  });

  it("Escenario 2: un pago rechazado no cambia el plan ni la fecha", () => {
    const users = repositoryWith(basicUser);
    const history = paymentHistoryWith();
    const result = new PaymentProcessingService(gatewayReturning("DECLINED"), users, undefined, history).processPayment(7, request);
    expect(history.recordCheckoutAttempt).toHaveBeenCalledWith(7, expect.objectContaining({ outcome: "DECLINED" }));
    expect(result).toMatchObject({ outcome: "DECLINED", plan: "BASICO", planExpiresAt: null, declineReason: "Fondos ficticios insuficientes." });
  });

  it.each([[undefined], [99]])("sin un usuario válido (%s) no llama a la pasarela", (userId) => {
    const gateway = gatewayReturning("APPROVED");
    const users = repositoryWith(null);
    const history = paymentHistoryWith();
    expect(() => new PaymentProcessingService(gateway, users, undefined, history).processPayment(userId, request)).toThrow(AuthenticationRequiredError);
    expect(gateway.simulate).not.toHaveBeenCalled();
    expect(history.recordApprovedCheckout).not.toHaveBeenCalled();
  });

  it("sin persistencia de historial no invoca la pasarela", () => {
    const gateway = gatewayReturning("APPROVED");
    const service = new PaymentProcessingService(gateway, repositoryWith(basicUser));
    expect(() => service.processPayment(7, request)).toThrow("El historial de facturación no está disponible");
    expect(gateway.simulate).not.toHaveBeenCalled();
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

describe("US34, historial persistente de facturación", () => {
  it("persiste operaciones entre instancias y revierte la activación si falla el registro", () => {
    const directory = mkdtempSync(join(tmpdir(), "yupay-us34-"));
    const file = join(directory, "users.sqlite");
    const payment = {
      reference: "DEMO-0123456789abcdef01234567",
      outcome: "APPROVED" as const,
      occurredAt: NOW.toISOString(),
      planId: "PRO" as const,
      amount: "9.90",
      currency: "PEN" as const,
      receiptStatus: "AVAILABLE" as const,
    };
    try {
      const users = new SqliteUserRepository(file);
      const user = users.create({ username: "u", email: "u@prueba.com", passwordHash: "h", plan: "BASICO", createdAt: NOW.toISOString() });
      users.recordApprovedCheckout(user.id, IN_30_DAYS, payment);
      const earlierPayment = {
        ...payment,
        reference: "DEMO-abcdef0123456789abcdef01",
        outcome: "DECLINED" as const,
        occurredAt: "2026-11-09T12:00:00.000Z",
      };
      users.recordCheckoutAttempt(user.id, earlierPayment);
      expect(users.findById(user.id)?.plan).toBe("PRO");
      expect(() => users.recordApprovedCheckout(user.id, "2027-01-01T00:00:00.000Z", payment)).toThrow();
      expect(users.findById(user.id)?.planExpiresAt).toBe(IN_30_DAYS);
      users.close();

      const reopened = new SqliteUserRepository(file);
      expect(reopened.findCheckoutHistory(user.id)).toEqual([payment, earlierPayment]);
      reopened.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("US31: lee el monto REAL como texto con 2 decimales y conserva null en pagos anteriores al precio", async () => {
    const directory = mkdtempSync(join(tmpdir(), "yupay-us31-"));
    const payment = {
      reference: "DEMO-00000000000000000000aaaa",
      outcome: "APPROVED" as const,
      occurredAt: NOW.toISOString(),
      planId: "PRO" as const,
      amount: "9.90",
      currency: "PEN" as const,
      receiptStatus: "AVAILABLE" as const,
    };
    const legacy = { ...payment, reference: "DEMO-00000000000000000000bbbb", occurredAt: "2026-11-01T12:00:00.000Z", amount: null };
    try {
      const users = new SqliteUserRepository(join(directory, "users.sqlite"));
      const user = users.create({ username: "u", email: "u31@prueba.com", passwordHash: "h", plan: "BASICO", createdAt: NOW.toISOString() });
      users.recordCheckoutAttempt(user.id, legacy);
      users.recordApprovedCheckout(user.id, IN_30_DAYS, payment);
      expect(users.findCheckoutHistory(user.id).map((item) => item.amount)).toEqual(["9.90", null]);
      for (const item of users.findCheckoutHistory(user.id)) {
        const pdf = await new PaymentReceiptGenerator().generate(item);
        expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      }
      users.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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

  it("lista solo las operaciones de la cuenta autenticada y descarga su comprobante PDF", async () => {
    const id = newBasic("historial@prueba.com");
    const otherId = newBasic("otro-historial@prueba.com");
    const approvedResponse = await pay("DEMO_APPROVED", tokenFor(id));
    const approved = await approvedResponse.json();
    const declinedResponse = await pay("DEMO_DECLINED", tokenFor(id));
    const declined = await declinedResponse.json();

    expect((await fetch(`${baseUrl}/api/checkout/history`)).status).toBe(401);
    const historyResponse = await fetch(`${baseUrl}/api/checkout/history`, {
      headers: { Authorization: `Bearer ${tokenFor(id)}` },
    });
    expect(historyResponse.status).toBe(200);
    const history = await historyResponse.json();
    expect(history.transactions).toHaveLength(2);
    expect(history.transactions.map((transaction: { reference: string }) => transaction.reference))
      .toContain(approved.reference);
    expect(history.transactions.map((transaction: { reference: string }) => transaction.reference))
      .toContain(declined.reference);
    expect(approved.amount).toBe("9.90");
    expect(declined.amount).toBe("9.90");
    // US31: el historial devuelve el monto como texto (no número), aunque SQLite lo guarde como REAL.
    expect(history.transactions.every((transaction: { amount: string | null }) => transaction.amount === "9.90")).toBe(true);
    const otherHistory = await fetch(`${baseUrl}/api/checkout/history`, {
      headers: { Authorization: `Bearer ${tokenFor(otherId)}` },
    });
    expect((await otherHistory.json()).transactions).toEqual([]);

    const ownReceipt = await fetch(`${baseUrl}/api/checkout/history/${approved.reference}/receipt`, {
      headers: { Authorization: `Bearer ${tokenFor(id)}` },
    });
    expect(ownReceipt.status).toBe(200);
    expect(ownReceipt.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await ownReceipt.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");

    const otherReceipt = await fetch(`${baseUrl}/api/checkout/history/${approved.reference}/receipt`, {
      headers: { Authorization: `Bearer ${tokenFor(otherId)}` },
    });
    expect(otherReceipt.status).toBe(404);
  });
});
