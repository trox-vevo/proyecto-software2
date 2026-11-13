import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import { hasProAccess } from "../../src/registration/domain/User";
import { SubscriptionNotActiveError, SubscriptionService } from "../../src/subscription/application/SubscriptionService";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";

describe("SubscriptionService", () => {
  it("programa una sola cancelación al final del período y conserva el acceso hasta entonces", () => {
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const users = new SqliteUserRepository(":memory:");
    const user = users.create({
      username: "pro",
      email: "pro@example.com",
      passwordHash: "hash",
      plan: "BASICO",
      createdAt: new Date().toISOString(),
    });
    users.activatePro(user.id, expiresAt);

    const service = new SubscriptionService(users);
    const first = service.cancelSubscription(user.id);
    const second = service.cancelSubscription(user.id);

    expect(first).toMatchObject({
      status: "CANCELLATION_SCHEDULED",
      plan: "PRO",
      planExpiresAt: expiresAt,
      planCancellationRequested: true,
    });
    expect(second).toEqual(first);
    expect(users.findById(user.id)).toMatchObject({ plan: "PRO", planExpiresAt: expiresAt, planCancellationRequested: true });
    expect(hasProAccess(users.findById(user.id)!)).toBe(true);
    users.close();
  });

  it("rechaza cancelar un usuario Básico o un período Pro vencido", () => {
    const users = new SqliteUserRepository(":memory:");
    const basic = users.create({
      username: "basico",
      email: "basic@example.com",
      passwordHash: "hash",
      plan: "BASICO",
      createdAt: new Date().toISOString(),
    });
    const expired = users.create({
      username: "vencido",
      email: "expired@example.com",
      passwordHash: "hash",
      plan: "BASICO",
      createdAt: new Date().toISOString(),
    });
    users.activatePro(expired.id, new Date(Date.now() - 1).toISOString());
    const service = new SubscriptionService(users);

    expect(() => service.cancelSubscription(basic.id)).toThrow(SubscriptionNotActiveError);
    expect(() => service.cancelSubscription(expired.id)).toThrow(SubscriptionNotActiveError);
    expect(users.findById(expired.id)?.plan).toBe("BASICO");
    users.close();
  });
});

describe("POST /api/subscription/cancel", () => {
  let server: Server;
  let baseUrl: string;
  const users = new SqliteUserRepository(":memory:");
  const previousWebhookSecret = process.env.SUBSCRIPTION_WEBHOOK_SECRET;
  const createUser = (email: string, pro = false) => {
    const user = users.create({
      username: "usuario",
      email,
      passwordHash: "hash",
      plan: "BASICO",
      createdAt: new Date().toISOString(),
    });
    if (pro) users.activatePro(user.id, new Date(Date.now() + 86_400_000).toISOString());
    return user.id;
  };
  const cancel = (token?: string) => fetch(`${baseUrl}/api/subscription/cancel`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const tokenFor = (id: number) => jwt.sign({ sub: String(id) }, getJwtSecret());

  beforeAll(async () => {
    process.env.SUBSCRIPTION_WEBHOOK_SECRET = "test-subscription-webhook-secret";
    server = createApp(
      { findFixedDepositsByDepartment: async () => [] },
      users,
      undefined,
      undefined,
      undefined,
      { resolveUser: async (req) => req.userId ? { id: req.userId, plan: "PRO" } : null },
    ).listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    users.close();
    if (previousWebhookSecret === undefined) delete process.env.SUBSCRIPTION_WEBHOOK_SECRET;
    else process.env.SUBSCRIPTION_WEBHOOK_SECRET = previousWebhookSecret;
  });

  it("requiere autenticación", async () => {
    const response = await cancel();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
  });

  it("responde 409 para un usuario sin Pro activo", async () => {
    const userId = createUser("basic@example.com");
    const response = await cancel(tokenFor(userId));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "SUBSCRIPTION_NOT_ACTIVE" });
  });

  it("programa la baja del Pro y conserva la fecha de fin del período", async () => {
    const userId = createUser("pro-cancel@example.com", true);
    const response = await cancel(tokenFor(userId));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "CANCELLATION_SCHEDULED",
      plan: "PRO",
      planCancellationRequested: true,
      message: "Tu suscripción Pro se cancelará al finalizar el período actual.",
    });
    expect(Date.parse(body.planExpiresAt)).toBeGreaterThan(Date.now());
    expect(users.findById(userId)).toMatchObject({ plan: "PRO", planCancellationRequested: true });
  });

  it("deja de autorizar beneficios Pro cuando termina el período, aunque el plan se haya cancelado", async () => {
    const userId = createUser("expired-pro@example.com", true);
    users.activatePro(userId, new Date(Date.now() - 1).toISOString());
    const response = await fetch(`${baseUrl}/api/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor(userId)}` },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "PRO_REQUIRED" });
  });

  it("degrada al recibir un fallo autenticado de renovación y expone el historial actualizado", async () => {
    const userId = createUser("payment-failed@example.com", true);
    const periodExpiresAt = users.findById(userId)!.planExpiresAt!;
    const event = {
      eventId: "payment-failure-42",
      userId,
      periodExpiresAt,
      occurredAt: new Date().toISOString(),
    };
    const request = () => fetch(`${baseUrl}/api/subscription/renewal-payment-failure`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Subscription-Webhook-Secret": "test-subscription-webhook-secret",
      },
      body: JSON.stringify(event),
    });

    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "DEGRADED" });
    expect(users.findById(userId)?.plan).toBe("BASICO");
    expect(await (await request()).json()).toEqual({ status: "ALREADY_PROCESSED" });

    const historyResponse = await fetch(`${baseUrl}/api/subscription/history`, {
      headers: { Authorization: `Bearer ${tokenFor(userId)}` },
    });
    expect(historyResponse.status).toBe(200);
    expect(await historyResponse.json()).toMatchObject({
      plan: "BASICO",
      planExpiresAt: null,
      history: [{
        fromPlan: "PRO",
        toPlan: "BASICO",
        reason: "RENEWAL_PAYMENT_FAILED",
        planExpiresAt: periodExpiresAt,
      }],
    });
  });

  it("rechaza eventos sin secreto válido y no permite consultar el historial sin sesión", async () => {
    const userId = createUser("webhook-security@example.com", true);
    const response = await fetch(`${baseUrl}/api/subscription/renewal-payment-failure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: "unauthorized-event",
        userId,
        periodExpiresAt: users.findById(userId)!.planExpiresAt,
        occurredAt: new Date().toISOString(),
      }),
    });
    expect(response.status).toBe(401);
    expect(users.findById(userId)?.plan).toBe("PRO");

    const history = await fetch(`${baseUrl}/api/subscription/history`);
    expect(history.status).toBe(401);
  });
});
