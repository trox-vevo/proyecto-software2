import "dotenv/config";
import { createApp } from "./app";
import { SqliteUserRepository } from "./registration/infrastructure/SqliteUserRepository";
import { SmtpRecoveryEmailService } from "./recovery/infrastructure/SmtpRecoveryEmailService";
import { SqliteFavoriteRepository } from "./favorites/infrastructure/SqliteFavoriteRepository";
import { FavoriteService } from "./favorites/application/FavoriteService";
import { createFavoriteUserResolver } from "./favorites/infrastructure/createFavoriteUserResolver";
import { assertNumericDatabase } from "./favorites/infrastructure/assertNumericDatabase";
import { FixedDepositSimulationService } from "./simulation/application/FixedDepositSimulationService";
import { SubscriptionMaintenanceService } from "./subscription/application/SubscriptionMaintenanceService";
import { startSubscriptionMaintenanceJob } from "./subscription/application/SubscriptionMaintenanceJob";
import { SmtpPlanChangeEmailService } from "./subscription/infrastructure/SmtpPlanChangeEmailService";
import { openDatabase } from "./shared/infrastructure/openDatabase";
import { SqliteProductRepository } from "./simulation/infrastructure/SqliteProductRepository";
import { RepositorioCuentasSqlite } from "./repositorio/RepositorioCuentasSqlite";
import { SqliteSbsRiskRepository } from "./risk/infrastructure/SqliteSbsRiskRepository";
import { SqliteEconomistReportRepository } from "./risk/infrastructure/SqliteEconomistReportRepository";
import { SqlitePerfilRepository } from "./profile/infrastructure/SqlitePerfilRepository";
import { createMarketMonitoringRuntime, monitoringSettings } from "./monitoring/infrastructure/createMarketMonitoringRuntime";

const PORT = process.env.PORT ?? 3000;
const marketConfiguration = monitoringSettings(process.env);
// Base de datos única: DB_PATH (USER_DB_PATH se acepta por compatibilidad)
const file = process.env.DB_PATH ?? process.env.USER_DB_PATH ?? "data/usuarios.sqlite";
assertNumericDatabase(file);
const users = new SqliteUserRepository(file); // crea users antes que el perfil la use
const favorites = new SqliteFavoriteRepository(file);
const database = openDatabase(file); // catálogo: entidades, productos, cuentas, SBS e informes
const products = new SqliteProductRepository(database);
const savingsAccounts = new RepositorioCuentasSqlite(database);
const marketRuntime = createMarketMonitoringRuntime(database, users, marketConfiguration);
if (marketConfiguration.enabled) {
  console.log("Monitoreo del catálogo SQLite local habilitado. TS-117/TS-120 pendientes; no se generan alertas de mercado.");
}
const stopSubscriptionMaintenanceJob = startSubscriptionMaintenanceJob(
  new SubscriptionMaintenanceService(users, new SmtpPlanChangeEmailService()),
);
const server = createApp(products, users, users, new SmtpRecoveryEmailService(), new SqlitePerfilRepository(database), {
  favoriteService: new FavoriteService(favorites, savingsAccounts, new FixedDepositSimulationService(products)),
  resolveUser: createFavoriteUserResolver(users),
  savingsAccounts,
  sbsRiskRepository: new SqliteSbsRiskRepository(database),
  economistReportRepository: new SqliteEconomistReportRepository(database),
}).listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void Promise.all([stopSubscriptionMaintenanceJob(), marketRuntime.stop()]).finally(() => server.close(() => {
      try { favorites.close(); } finally { try { users.close(); } finally { database.close(); } }
    }));
  });
}
