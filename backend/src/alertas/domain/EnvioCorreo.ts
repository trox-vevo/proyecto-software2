import type { NotificationType } from "../../notifications/NotificationPreferences";
import type { NotificationQueueRepository, QueuedNotification } from "../../notifications/queue/domain/QueueContracts";

// US40: contratos del envío de correo de emergencia. El servicio depende de estas interfaces,
// no de SMTP, de la base de datos ni de la cola concreta, así que cada pieza se puede cambiar o simular.

/** Lo que el envío necesita de la cola de US39: reservar mensajes, confirmarlos o marcarlos como fallidos. */
export type ColaCorreo = Pick<NotificationQueueRepository, "claimPending" | "markDelivered" | "markFailed">;

/** Lo mínimo de una alerta que necesita el correo, con los valores ya listos para mostrar. */
export interface DatosAlertaCorreo {
  /** Id de la notificación en la cola: el enlace del correo abre esa alerta en la plataforma (US36). */
  id: number;
  entidad: string;
  tipo: NotificationType;
  /** Tasas como "5.50%" o calificaciones de la SBS como "A-". */
  valorAnterior: string;
  valorNuevo: string;
  /** Variación porcentual de la tasa, por ejemplo "+20.00%". null en las alertas de riesgo. */
  variacionPct: string | null;
}

/** Correo ya armado, listo para enviar. */
export interface ContenidoCorreo {
  asunto: string;
  html: string;
  texto: string;
}

/** Envía un correo. Devuelve false si el proveedor no lo aceptó; puede lanzar si el servicio falla. */
export interface ProveedorCorreo {
  enviar(para: string, contenido: ContenidoCorreo): Promise<boolean>;
}

/** Datos de un usuario que necesita el envío. SqliteUserRepository ya lo cumple. */
export interface BuscadorUsuarios {
  findById(id: number): { email: string } | null;
}

/** Arma los datos del correo a partir de una notificación de la cola; null si no se puede (por ejemplo, la entidad no existe). */
export interface ResolvedorAlertaCorreo {
  resolver(notificacion: QueuedNotification): DatosAlertaCorreo | null;
}

/** Una vez por intento de envío; sirve para auditar qué pasó con cada notificación. */
export interface IntentoEnvio {
  notificacionId: number;
  numero: number;
  resultado: "OK" | "ERROR";
  /** Mensaje del fallo, sin direcciones de correo; null si salió bien. */
  error: string | null;
  momento: Date;
}

export interface RegistroEnvios {
  registrarIntento(intento: IntentoEnvio): void;
  /** Se llama una sola vez cuando ya no se va a reintentar (se agotaron los intentos o no tenía sentido reintentar). */
  registrarAgotado(notificacionId: number, error: string): void;
  /** Algo no salió como se esperaba pero no es un fallo de envío, por ejemplo una reserva vencida en la cola. */
  registrarAviso(notificacionId: number, mensaje: string): void;
}

/** Espera un tiempo. Las pruebas usan una versión que no espera de verdad. */
export interface Temporizador {
  esperar(ms: number): Promise<void>;
}
/** Decide, justo antes de enviar, si el usuario todavía puede recibir esta alerta (acceso Pro vigente y preferencias actuales). */
export interface AutorizadorEnvio {
  puedeRecibir(userId: number, tipo: NotificationType): boolean;
}

/** Decide, justo antes de enviar, si el usuario todavía puede recibir esta alerta (acceso Pro vigente y preferencias actuales). */
export interface AutorizadorEnvio {
  puedeRecibir(userId: number, tipo: NotificationType): boolean;
}
