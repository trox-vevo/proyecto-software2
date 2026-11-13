export type PlanChangeReason = "PERIOD_EXPIRED" | "RENEWAL_PAYMENT_FAILED";

export interface PlanChangeHistoryEntry {
  id: number;
  fromPlan: "PRO";
  toPlan: "BASICO";
  reason: PlanChangeReason;
  changedAt: string;
  planExpiresAt: string;
}

export interface PendingPlanChangeNotification {
  id: number;
  userId: number;
  email: string;
  planExpiresAt: string;
  reason: PlanChangeReason;
  changedAt: string;
}

export interface RenewalPaymentFailureEvent {
  eventId: string;
  userId: number;
  periodExpiresAt: string;
  occurredAt: string;
}

export interface SubscriptionMaintenanceRepository {
  processDueProDowngrades(now: string): void;
  recordRenewalPaymentFailure(
    event: RenewalPaymentFailureEvent,
  ): "DEGRADED" | "ALREADY_PROCESSED" | "NOT_ACTIVE";
  findPlanChangeHistory(userId: number): PlanChangeHistoryEntry[];
  findPendingPlanChangeNotifications(): PendingPlanChangeNotification[];
  markPlanChangeNotificationSent(id: number, sentAt: string): void;
}
