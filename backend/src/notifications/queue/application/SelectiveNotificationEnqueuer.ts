import type { NotificationPreferencesService } from "../../NotificationPreferencesService";
import type { ProAccessService } from "../../../auth/application/ProAccessService";
import type { AlertEvent, EligibleRecipient, NotificationQueueRepository, QueueInput } from "../domain/QueueContracts";
import { frequency, isoDate, userId, validateEvent } from "../domain/QueueValidation";

export class SelectiveNotificationEnqueuer {
  constructor(private readonly queue: NotificationQueueRepository,
    private readonly access: Pick<ProAccessService, "hasProAccess">,
    private readonly preferences: Pick<NotificationPreferencesService, "get">,
    private readonly now: () => Date = () => new Date()) {}

  enqueueEligible(event: AlertEvent, recipients: readonly EligibleRecipient[]): number {
    const validatedEvent = validateEvent(event);
    if (!Array.isArray(recipients)) throw new TypeError("Selección inválida.");
    const now = this.now().toISOString();
    const inputs: QueueInput[] = recipients.map((recipient) => {
      if (!recipient || recipient.eventId !== event.eventId) throw new TypeError("Selección de otro evento.");
      userId(recipient.userId);
      frequency(recipient.frequency);
      if (recipient.frequency === "RESUMEN_DIARIO" && !recipient.availableAt) {
        throw new TypeError("El resumen necesita fecha de disponibilidad acordada por el equipo.");
      }
      const availableAt = isoDate(recipient.availableAt ?? now);
      if (recipient.frequency === "RESUMEN_DIARIO" && availableAt <= now) {
        throw new RangeError("La fecha del resumen debe ser futura.");
      }
      return { event: validatedEvent, userId: recipient.userId, frequency: recipient.frequency, availableAt };
    });
    // Revalidación defensiva del estado del servidor. TS-120 conserva el cruce por entidad.
    const accepted = inputs.filter((item) => {
      if (!this.access.hasProAccess(item.userId)) return false;
      const preference = this.preferences.get(item.userId);
      return preference.alertTypes.includes(event.type) && preference.frequency === item.frequency;
    });
    return this.queue.enqueueBatch(accepted, now);
  }
}
