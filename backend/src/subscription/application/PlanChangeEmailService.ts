import type { PlanChangeReason } from "../domain/SubscriptionMaintenanceRepository";

export interface PlanChangeEmailService {
  sendPlanDowngradeNotification(
    email: string,
    planExpiresAt: string,
    reason: PlanChangeReason,
    changedAt: string,
  ): Promise<boolean>;
}
