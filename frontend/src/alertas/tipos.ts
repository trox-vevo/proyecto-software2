import type { CoberturaFSD } from "../fsd/IndicadorFSD";

/** Qué cambió: la tasa de la entidad o su calificación de riesgo. */
export type TipoAlerta = "TASA" | "RIESGO";

/**
 * PROPUESTA de la forma de una alerta, armada con los criterios de US35, US36 y US40.
 * El modelo real lo define US38/US39: cuando exista, se ajustan los nombres aquí.
 * Las tasas van como texto ya formateado, igual que FilaAhorro.
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