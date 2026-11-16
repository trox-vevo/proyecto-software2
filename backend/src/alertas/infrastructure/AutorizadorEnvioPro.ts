import type { ProAccessService } from "../../auth/application/ProAccessService";
import type { NotificationType } from "../../notifications/NotificationPreferences";
import type { NotificationPreferencesService } from "../../notifications/NotificationPreferencesService";
import type { AutorizadorEnvio } from "../domain/EnvioCorreo";

/**
 * US40: revisa, justo antes de enviar, que el usuario siga teniendo acceso Pro vigente y que sus
 * preferencias actuales incluyan este tipo de alerta con frecuencia inmediata. Es la misma regla que
 * aplica la cola al encolar (SelectiveNotificationEnqueuer), pero con el estado de ahora: entre el
 * encolado y el envío el plan puede haber vencido o el usuario puede haber cambiado sus preferencias.
 */
export class AutorizadorEnvioPro implements AutorizadorEnvio {
  constructor(
    private readonly acceso: Pick<ProAccessService, "hasProAccess">,
    private readonly preferencias: Pick<NotificationPreferencesService, "get">,
  ) {}

  puedeRecibir(userId: number, tipo: NotificationType): boolean {
    if (!this.acceso.hasProAccess(userId)) return false;
    const actuales = this.preferencias.get(userId);
    return actuales.alertTypes.includes(tipo) && actuales.frequency === "INMEDIATA";
  }
}
