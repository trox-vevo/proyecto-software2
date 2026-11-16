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
import { SqliteMarketVariationDetector, rateChangeThreshold } from "./SqliteMarketVariationDetector";
import { SqliteAlertMatchingService } from "../../notifications/queue/infrastructure/SqliteAlertMatchingService";

export function monitoringSettings(env: NodeJS.ProcessEnv) {
  const enabled = env.MARKET_MONITORING_ENABLED ?? "true";
  if (enabled !== "true" && enabled !== "false") throw new TypeError("MARKET_MONITORING_ENABLED requiere true o false.");
  return { enabled: enabled === "true", intervalMs: monitoringInterval(env.MARKET_MONITORING_INTERVAL_MS ?? "60000"),
    rateThreshold: rateChangeThreshold(env.MARKET_RATE_CHANGE_THRESHOLD) };
}

/** Usa detector y cruce SQLite por defecto; permite sustituir ambos juntos en pruebas o adaptadores. */
export function createMarketMonitoringRuntime(database: DatabaseSync,
  users: Pick<UserRepository, "findById"> & NotificationPreferencesRepository,
  config: { enabled: boolean; intervalMs: number; rateThreshold?: string },
  extensions: { provider?: MarketDataProvider; detector?: MarketVariationDetector;
    matcher?: AlertMatchingService; logger?: MonitoringLogger } = {}) {
  if (Boolean(extensions.detector) !== Boolean(extensions.matcher)) {
    throw new Error("La detección y el cruce deben conectarse juntos para publicar alertas.");
  }
  monitoringInterval(config.intervalMs);
  const queue = new SqliteNotificationQueueRepository(database);
  const access = new ProAccessService(users);
  const preferences = new NotificationPreferencesService(users);
  const enqueuer = new SelectiveNotificationEnqueuer(queue, access, preferences);
  const matcher = extensions.matcher ?? new SqliteAlertMatchingService(database, access, preferences);
  const detector = extensions.detector ?? new SqliteMarketVariationDetector(database, config.rateThreshold);
  const publisher = {
    async publish(events: readonly Parameters<SelectiveNotificationEnqueuer["enqueueEligible"]>[0][]) {
      for (const event of events) enqueuer.enqueueEligible(event, await matcher.findEligible(event));
    },
  };
  const job = new MarketMonitoringJob(new MonitoringCycleService(
    extensions.provider ?? new SqliteMarketDataProvider(database), detector, publisher), config, extensions.logger);
  if (config.enabled) job.start();
  return { queue, enqueuer, publisher, job, stop: () => job.stop() };
}
