export const NOTIFICATION_TYPES = ["CAMBIO_TASA", "CAMBIO_RIESGO"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_FREQUENCIES = ["INMEDIATA", "RESUMEN_DIARIO"] as const;
export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number];

export interface NotificationPreferences {
  alertTypes: NotificationType[];
  frequency: NotificationFrequency;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  alertTypes: [...NOTIFICATION_TYPES],
  frequency: "INMEDIATA",
};

export function isNotificationPreferences(value: unknown): value is NotificationPreferences {
  if (typeof value !== "object" || value === null) return false;
  const preferences = value as Record<string, unknown>;
  return (
    Array.isArray(preferences.alertTypes) &&
    preferences.alertTypes.length > 0 &&
    preferences.alertTypes.every((type) =>
      NOTIFICATION_TYPES.includes(type as NotificationType),
    ) &&
    (preferences.frequency === "INMEDIATA" || preferences.frequency === "RESUMEN_DIARIO")
  );
}

export class InvalidNotificationPreferencesError extends Error {}

export interface NotificationPreferencesRepository {
  findNotificationPreferences(userId: number): NotificationPreferences | undefined;
  saveNotificationPreferences(
    userId: number,
    preferences: NotificationPreferences,
  ): void;
}
