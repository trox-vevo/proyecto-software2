import { afterEach, describe, expect, it, vi } from "vitest";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";
import { startSubscriptionMaintenanceJob } from "../../src/subscription/application/SubscriptionMaintenanceJob";
import { SubscriptionMaintenanceService } from "../../src/subscription/application/SubscriptionMaintenanceService";

function createUser(
  users: SqliteUserRepository,
  email: string,
  expiresAt: string,
): number {
  const user = users.create({
    username: "usuario",
    email,
    passwordHash: "hash",
    plan: "BASICO",
    createdAt: new Date().toISOString(),
  });
  users.activatePro(user.id, expiresAt);
  return user.id;
}

describe("SubscriptionMaintenanceService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("degrada al vencer, notifica una vez y conserva las suscripciones vigentes", async () => {
    const users = new SqliteUserRepository(":memory:");
    const now = new Date(Date.now() + 10_000);
    const expiredId = createUser(users, "expired@example.com", new Date(now.getTime() - 1).toISOString());
    const activeId = createUser(users, "active@example.com", new Date(now.getTime() + 60_000).toISOString());
    const email = { sendPlanDowngradeNotification: vi.fn().mockResolvedValue(true) };
    const service = new SubscriptionMaintenanceService(users, email, () => now);

    await service.runOnce();
    await service.runOnce();

    expect(users.findById(expiredId)).toMatchObject({
      plan: "BASICO",
      planExpiresAt: null,
      planCancellationRequested: false,
    });
    expect(users.findById(activeId)?.plan).toBe("PRO");
    expect(email.sendPlanDowngradeNotification).toHaveBeenCalledOnce();
    expect(email.sendPlanDowngradeNotification).toHaveBeenCalledWith(
      "expired@example.com",
      new Date(now.getTime() - 1).toISOString(),
      "PERIOD_EXPIRED",
      now.toISOString(),
    );
    expect(users.findPlanChangeHistory(expiredId)).toMatchObject([{
      fromPlan: "PRO",
      toPlan: "BASICO",
      reason: "PERIOD_EXPIRED",
      planExpiresAt: new Date(now.getTime() - 1).toISOString(),
    }]);
    expect(users.findPendingPlanChangeNotifications()).toEqual([]);
    users.close();
  });

  it("degrada inmediatamente ante fallo definitivo de renovación y procesa eventos duplicados una sola vez", async () => {
    const users = new SqliteUserRepository(":memory:");
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const userId = createUser(users, "payment-failure@example.com", expiresAt);
    const failedAt = new Date().toISOString();
    const event = {
      eventId: "provider-event-1",
      userId,
      periodExpiresAt: expiresAt,
      occurredAt: failedAt,
    };

    expect(users.recordRenewalPaymentFailure(event)).toBe("DEGRADED");
    expect(users.recordRenewalPaymentFailure(event)).toBe("ALREADY_PROCESSED");
    expect(users.findById(userId)).toMatchObject({
      plan: "BASICO",
      planExpiresAt: null,
      planCancellationRequested: false,
    });
    expect(users.findPlanChangeHistory(userId)).toMatchObject([{
      reason: "RENEWAL_PAYMENT_FAILED",
      changedAt: failedAt,
      planExpiresAt: expiresAt,
    }]);

    const email = { sendPlanDowngradeNotification: vi.fn().mockResolvedValue(true) };
    await new SubscriptionMaintenanceService(users, email).runOnce();
    expect(email.sendPlanDowngradeNotification).toHaveBeenCalledWith(
      "payment-failure@example.com",
      expiresAt,
      "RENEWAL_PAYMENT_FAILED",
      failedAt,
    );
    users.close();
  });

  it("no degrada un plan Pro distinto al período indicado por el evento", () => {
    const users = new SqliteUserRepository(":memory:");
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const userId = createUser(users, "stale-event@example.com", expiresAt);

    expect(users.recordRenewalPaymentFailure({
      eventId: "stale-event",
      userId,
      periodExpiresAt: new Date(Date.now() + 172_800_000).toISOString(),
      occurredAt: new Date().toISOString(),
    })).toBe("NOT_ACTIVE");
    expect(users.findById(userId)?.plan).toBe("PRO");
    expect(users.findPlanChangeHistory(userId)).toEqual([]);
    users.close();
  });

  it("conserva la notificación pendiente si el correo falla y la reintenta", async () => {
    const users = new SqliteUserRepository(":memory:");
    const now = new Date(Date.now() + 10_000);
    createUser(users, "retry@example.com", new Date(now.getTime() - 1).toISOString());
    const email = { sendPlanDowngradeNotification: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) };
    const logger = { error: vi.fn() };
    const service = new SubscriptionMaintenanceService(users, email, () => now, logger);

    await service.runOnce();
    expect(users.findPendingPlanChangeNotifications()).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledOnce();

    await service.runOnce();
    expect(users.findPendingPlanChangeNotifications()).toEqual([]);
    expect(email.sendPlanDowngradeNotification).toHaveBeenCalledTimes(2);
    users.close();
  });

  it("inicia el job al arrancar, evita ejecuciones solapadas y espera al detenerse", async () => {
    vi.useFakeTimers();
    let finishRun!: () => void;
    const service = {
      runOnce: vi.fn(() => new Promise<void>((resolve) => { finishRun = resolve; })),
    };
    const stop = startSubscriptionMaintenanceJob(service, 100, { error: vi.fn() });
    expect(service.runOnce).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(300);
    expect(service.runOnce).toHaveBeenCalledOnce();

    const stopping = stop();
    finishRun();
    await stopping;
    await vi.advanceTimersByTimeAsync(300);
    expect(service.runOnce).toHaveBeenCalledOnce();
  });
});
