import Decimal from "decimal.js";
import { NOTIFICATION_TYPES, NOTIFICATION_FREQUENCIES, type NotificationFrequency } from "../../NotificationPreferences";
import type { AlertEvent, QueueInput } from "./QueueContracts";
import { numericIdentifier } from "../../../registration/domain/NumericIdentifier";

export function isoDate(value: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new TypeError("Se requiere una fecha ISO UTC canónica.");
  }
  return value;
}
export function userId(value: number): number {
  if (typeof value !== "number") throw new TypeError("Identificador numérico requerido.");
  return numericIdentifier(value);
}
export function frequency(value: NotificationFrequency): NotificationFrequency {
  if (!NOTIFICATION_FREQUENCIES.includes(value)) throw new TypeError("Frecuencia inválida.");
  return value;
}
export function validateEvent(event: AlertEvent): AlertEvent {
  if (!event || typeof event.eventId !== "string" || !event.eventId.trim() || event.eventId.length > 200 ||
      !NOTIFICATION_TYPES.includes(event.type)) throw new TypeError("Evento inválido.");
  userId(event.entityId);
  isoDate(event.occurredAt);
  for (const value of [event.previousValue, event.currentValue]) {
    if (typeof value !== "string" || !value.trim() || value.length > 1000) throw new TypeError("Valor de evento inválido.");
    if (event.type === "CAMBIO_TASA" && !new Decimal(value).isFinite()) throw new TypeError("Tasa inválida.");
  }
  // Orden estable y copia defensiva para la clave de evento persistida.
  return { eventId: event.eventId, entityId: event.entityId, type: event.type,
    previousValue: event.previousValue, currentValue: event.currentValue, occurredAt: event.occurredAt };
}
export function validateInput(item: QueueInput): QueueInput {
  return { event: validateEvent(item.event), userId: userId(item.userId), frequency: frequency(item.frequency),
    availableAt: isoDate(item.availableAt) };
}
