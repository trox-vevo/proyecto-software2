// SUPUESTO: la cola de notificaciones la define US39, que todavía no existe.
// Cuando esté lista se ajusta este archivo; el servicio de envío solo usa estas dos interfaces.

export type EstadoNotificacion = "PENDIENTE" | "ENVIADA" | "FALLIDA";

export interface NotificacionPendiente {
  id: number;
  usuarioId: number;
  alertaId: number;
  estado: EstadoNotificacion;
}

export interface ColaNotificaciones {
  /** Siguiente notificación pendiente de enviar por correo, o null si no hay. */
  siguiente(): NotificacionPendiente | null;
  marcarEnviada(id: number): void;
  marcarFallida(id: number): void;
}
