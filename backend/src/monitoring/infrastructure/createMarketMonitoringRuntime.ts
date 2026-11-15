import type { DatabaseSync } from "node:sqlite";
import { MarketMonitoringJob, monitoringInterval } from "../application/MarketMonitoringJob";
import { MonitoringCycleService } from "../application/MonitoringCycleService";
import { SqliteMarketDataProvider } from "./SqliteMarketDataProvider";
import type { MarketDataProvider, MarketVariationDetector, MonitoringLogger } from "../domain/MonitoringContracts";
import type { AlertMatchingService } from "../../notifications/queue/domain/QueueContracts";
import { SqliteNotificationQueueRepository } from "../../notifications/queue/infrastructure/SqliteNotificationQueueRepository";
import { SelectiveNotificationEnqueuer } from "../../notifications/queue/application/SelectiveNotificationEnqueuer";
import { ProAccessService } from "../../auth/application/ProAccessService";
import { NotificationPreferencesService } from "../../notifications/NotificationPreferencesService";
import type { UserRepository } from "../../registration/domain/UserRepository";
import type { NotificationPreferencesRepository } from "../../notifications/NotificationPreferences";

export function monitoringSettings(env: NodeJS.ProcessEnv) {
  const enabled = env.MARKET_MONITORING_ENABLED ?? "false";
  if (enabled !== "true" && enabled !== "false") throw new TypeError("MARKET_MONITORING_ENABLED requiere true o false.");
  return { enabled: enabled === "true", intervalMs: monitoringInterval(env.MARKET_MONITORING_INTERVAL_MS ?? "60000") };
}

/** Composition root interno. TS-117 y TS-120 se inyectan juntos cuando el equipo los provea. */
export function createMarketMonitoringRuntime(database: DatabaseSync,
  users: Pick<UserRepository, "findById"> & NotificationPreferencesRepository,
  config: { enabled: boolean; intervalMs: number },
  extensions: { provider?: MarketDataProvider; detector?: MarketVariationDetector;
    matcher?: AlertMatchingService; logger?: MonitoringLogger } = {}) {
  if (Boolean(extensions.detector) !== Boolean(extensions.matcher)) {
    throw new Error("La detección y el cruce deben conectarse juntos para publicar alertas.");
  }
  monitoringInterval(config.intervalMs);
  const queue = new SqliteNotificationQueueRepository(database);
  const enqueuer = new SelectiveNotificationEnqueuer(queue, new ProAccessService(users), new NotificationPreferencesService(users));
  const matcher = extensions.matcher;
  const publisher = matcher ? {
    async publish(events: readonly Parameters<SelectiveNotificationEnqueuer["enqueueEligible"]>[0][]) {
      for (const event of events) enqueuer.enqueueEligible(event, await matcher.findEligible(event));
    },
  } : undefined;
  const job = new MarketMonitoringJob(new MonitoringCycleService(
    extensions.provider ?? new SqliteMarketDataProvider(database), extensions.detector, publisher), config, extensions.logger);
  if (config.enabled) job.start();
  return { queue, enqueuer, publisher, job, stop: () => job.stop() };
}
