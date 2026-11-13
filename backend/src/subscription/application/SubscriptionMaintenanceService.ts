import type { PlanChangeEmailService } from "./PlanChangeEmailService";
import type { SubscriptionMaintenanceRepository } from "../domain/SubscriptionMaintenanceRepository";

export interface SubscriptionMaintenanceLogger {
  error(message: string, error: unknown): void;
}

export class SubscriptionMaintenanceService {
  constructor(
    private readonly repository: SubscriptionMaintenanceRepository,
    private readonly emailService: PlanChangeEmailService,
    private readonly now: () => Date = () => new Date(),
    private readonly logger: SubscriptionMaintenanceLogger = console,
  ) {}

  async runOnce(): Promise<void> {
    this.repository.processDueProDowngrades(this.now().toISOString());
    const notifications = this.repository.findPendingPlanChangeNotifications();

    for (const notification of notifications) {
      let accepted: boolean;
      try {
        accepted = await this.emailService.sendPlanDowngradeNotification(
          notification.email,
          notification.planExpiresAt,
          notification.reason,
          notification.changedAt,
        );
      } catch (error) {
        this.logger.error("No se pudo enviar la notificación de cambio de plan.", error);
        continue;
      }

      if (!accepted) {
        this.logger.error(
          "El servicio de correo no aceptó la notificación de cambio de plan.",
          new Error(`Notificación ${notification.id} pendiente de reintento.`),
        );
        continue;
      }

      this.repository.markPlanChangeNotificationSent(notification.id, this.now().toISOString());
    }
  }
}
