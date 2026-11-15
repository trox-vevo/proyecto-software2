import type { NotificationType, NotificationFrequency } from "../../NotificationPreferences";

export interface AlertEvent {
  eventId: string;
  entityId: number;
  type: NotificationType;
  previousValue: string;
  currentValue: string;
  occurredAt: string;
}
/** Selección interna de TS-120. La cola no expone una ruta HTTP. */
export interface EligibleRecipient {
  userId: number;
  eventId: string;
  frequency: NotificationFrequency;
  /** Obligatorio para resumen diario. TS-120/US40 acuerdan fecha y zona horaria. */
  availableAt?: string;
}
export interface AlertMatchingService {
  findEligible(event: AlertEvent): Promise<readonly EligibleRecipient[]>;
}
export type MessageStatus = "PENDING" | "CLAIMED" | "SENT" | "FAILED";
export interface QueueInput {
  event: AlertEvent;
  userId: number;
  frequency: NotificationFrequency;
  availableAt: string;
}
export interface QueuedNotification extends QueueInput {
  id: number;
  idempotencyKey: string;
  status: MessageStatus;
  createdAt: string;
  claimToken: string | null;
  leaseUntil: string | null;
  lastError: string | null;
}
export interface NotificationQueueRepository {
  enqueueBatch(items: readonly QueueInput[], now: string): number;
  findById(id: number): QueuedNotification | null;
  pending(frequency: NotificationFrequency, limit: number, now: string): QueuedNotification[];
  claimPending(frequency: NotificationFrequency, limit: number, now: string, leaseMs: number): QueuedNotification[];
  markDelivered(id: number, token: string, now: string): boolean;
  markFailed(id: number, token: string, error: string, now: string): boolean;
}
