import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  InvalidNotificationPreferencesError,
  isNotificationPreferences,
  type NotificationPreferences,
  type NotificationPreferencesRepository,
} from "./NotificationPreferences";

export class NotificationPreferencesService {
  constructor(private readonly repository: NotificationPreferencesRepository) {}

  get(userId: number): NotificationPreferences {
    const preferences = this.repository.findNotificationPreferences(userId);
    return preferences ?? {
      alertTypes: [...DEFAULT_NOTIFICATION_PREFERENCES.alertTypes],
      frequency: DEFAULT_NOTIFICATION_PREFERENCES.frequency,
    };
  }

  save(userId: number, value: unknown): NotificationPreferences {
    if (!isNotificationPreferences(value) || new Set(value.alertTypes).size !== value.alertTypes.length) {
      throw new InvalidNotificationPreferencesError(
        "Selecciona al menos un tipo de alerta y una frecuencia válida.",
      );
    }

    const preferences: NotificationPreferences = {
      alertTypes: [...value.alertTypes],
      frequency: value.frequency,
    };
    this.repository.saveNotificationPreferences(userId, preferences);
    return preferences;
  }
}
