import type { SubscriptionMaintenanceService } from "./SubscriptionMaintenanceService";
import type { SubscriptionMaintenanceLogger } from "./SubscriptionMaintenanceService";

export function startSubscriptionMaintenanceJob(
  service: Pick<SubscriptionMaintenanceService, "runOnce">,
  intervalMs = 60_000,
  logger: SubscriptionMaintenanceLogger = console,
): () => Promise<void> {
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0) {
    throw new RangeError("El intervalo del mantenimiento debe ser un entero positivo.");
  }

  let activeRun: Promise<void> | null = null;
  const run = () => {
    if (activeRun) return activeRun;
    activeRun = (async () => {
      try {
        await service.runOnce();
      } catch (error) {
        logger.error("Falló el mantenimiento de suscripciones.", error);
      }
    })().finally(() => {
      activeRun = null;
    });
    return activeRun;
  };

  void run();
  const timer = setInterval(() => void run(), intervalMs);
  return async () => {
    clearInterval(timer);
    await activeRun;
  };
}
