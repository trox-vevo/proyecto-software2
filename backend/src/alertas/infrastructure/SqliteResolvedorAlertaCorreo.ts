import type { DatabaseSync } from "node:sqlite";
import Decimal from "decimal.js";
import type { QueuedNotification } from "../../notifications/queue/domain/QueueContracts";
import type { DatosAlertaCorreo, ResolvedorAlertaCorreo } from "../domain/EnvioCorreo";

/** 0.055 -> "5.50%". Las tasas del catálogo y de los eventos vienen como fracción. */
const porcentaje = (fraccion: string) => `${new Decimal(fraccion).times(100).toFixed(2)}%`;

/** Variación porcentual de la tasa: "+20.00%" o "-15.56%". null si la tasa anterior era 0. */
function variacion(anterior: string, nuevo: string): string | null {
  const base = new Decimal(anterior);
  if (base.isZero()) return null;
  const cambio = new Decimal(nuevo).minus(base).dividedBy(base).times(100);
  return `${cambio.isZero() || cambio.isNegative() ? "" : "+"}${cambio.toFixed(2)}%`;
}

/**
 * Arma los datos del correo a partir de un evento de la cola: el nombre de la entidad sale
 * del catálogo (financial_entities) y los valores se formatean para mostrarse.
 */
export class SqliteResolvedorAlertaCorreo implements ResolvedorAlertaCorreo {
  constructor(private readonly database: DatabaseSync) {}

  resolver(notificacion: QueuedNotification): DatosAlertaCorreo | null {
    const { event } = notificacion;
    const entidad = this.database
      .prepare("SELECT name FROM financial_entities WHERE id = ?")
      .get(event.entityId) as unknown as { name: string } | undefined;
    if (!entidad) return null;

    const esTasa = event.type === "CAMBIO_TASA";
    return {
      id: notificacion.id,
      entidad: entidad.name,
      tipo: event.type,
      valorAnterior: esTasa ? porcentaje(event.previousValue) : event.previousValue,
      valorNuevo: esTasa ? porcentaje(event.currentValue) : event.currentValue,
      variacionPct: esTasa ? variacion(event.previousValue, event.currentValue) : null,
    };
  }
}
