import type { DatabaseSync } from "node:sqlite";
import type { AlertEvent, AlertMatchingService, EligibleRecipient } from "../domain/QueueContracts";
import { validateEvent } from "../domain/QueueValidation";
import type { ProAccessService } from "../../../auth/application/ProAccessService";
import type { NotificationPreferencesService } from "../../NotificationPreferencesService";

/** La relación seguida existente es el producto guardado en favoritos de plazo fijo. */
export class SqliteAlertMatchingService implements AlertMatchingService {
  constructor(private readonly database: DatabaseSync,
    private readonly access: Pick<ProAccessService, "hasProAccess">,
    private readonly preferences: Pick<NotificationPreferencesService, "get">,
    private readonly now: () => Date = () => new Date()) {}

  async findEligible(event: AlertEvent): Promise<EligibleRecipient[]> {
    validateEvent(event);
    // Se excluye JSON inválido y no se infieren entidades a partir del nombre o del ID de cuenta.
    const rows = this.database.prepare(`SELECT DISTINCT f.user_id FROM favorite_simulations f
      JOIN fixed_deposit_products p ON p.id = CASE WHEN json_valid(f.parameters_json)
        THEN json_extract(f.parameters_json,'$.productId') END
      WHERE f.instrument='PLAZO_FIJO' AND p.entity_id=? ORDER BY f.user_id`).all(event.entityId);
    const recipients: EligibleRecipient[] = [];
    for (const row of rows) {
      const id = Number(row.user_id);
      if (!Number.isSafeInteger(id) || id <= 0 || !this.access.hasProAccess(id)) continue;
      const preference = this.preferences.get(id);
      if (!preference.alertTypes.includes(event.type)) continue;
      if (preference.frequency === "RESUMEN_DIARIO") {
        const next = new Date(this.now().getTime());
        next.setUTCHours(24, 0, 0, 0);
        recipients.push({ userId: id, eventId: event.eventId, frequency: preference.frequency, availableAt: next.toISOString() });
      } else {
        recipients.push({ userId: id, eventId: event.eventId, frequency: preference.frequency });
      }
    }
    return recipients;
  }
}
