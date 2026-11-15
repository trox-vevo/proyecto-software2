import type { CoberturaFSD } from "../fsd/IndicadorFSD";

/** Qué cambió: la tasa de la entidad o su calificación de riesgo. */
export type TipoAlerta = "TASA" | "RIESGO";

/**
 * Forma de una alerta tal como la devuelve GET /api/alertas
 */
export interface Alerta {
  /** Entero positivo, como los demás identificadores del proyecto. */
  id: number;
  /** Mismo identificador numérico de entidad que usan la SBS y los informes (entityId). */
  entidadId: number;
  entidad: string;
  tipo: TipoAlerta;
  tasaAnterior: string | null;
  tasaNueva: string | null;
  /** Variación porcentual de la tasa, por ejemplo "-15.56%". */
  variacionPct: string | null;
  /** Calificación de la SBS antes del cambio (A+, A, A-, B+ ... E); null si no tenía datos. */
  calificacionAnterior: string | null;
  /** Calificación de la SBS actualizada; null si la entidad no tiene datos. El semáforo se obtiene con nivelDeCalificacion. */
  calificacion: string | null;
  coberturaFSD: CoberturaFSD;
  leida: boolean;
  /** Fecha y hora de creación en formato ISO 8601. */
  creadaEn: string;
}