import type { AlertEvent } from "../../notifications/queue/domain/QueueContracts";

// US35/US36: forma de una alerta dentro de la plataforma. Cada alerta es una fila de la cola de US39.

export type EstadoFSD = "CUBIERTO" | "NO_CUBIERTO" | "NO_VERIFICADO";

/** Misma forma que CoberturaFSD del frontend (IndicadorFSD.tsx). */
export interface CoberturaFSD {
  estado: EstadoFSD;
  entidadFinanciera: string | null;
  fechaVerificacion: string | null;
  vigenteHasta: string | null;
  fuente: string | null;
}

/** Lo que recibe el frontend. Un evento trae un solo par de valores: tasas o calificaciones, nunca ambos. */
export interface AlertaApi {
  /** Id de la fila de la cola; es el mismo que lleva el enlace /?alerta=ID del correo. */
  id: number;
  entidadId: number;
  entidad: string;
  tipo: "TASA" | "RIESGO";
  /** Tasas ya formateadas ("5.00%"); null en las alertas de riesgo. */
  tasaAnterior: string | null;
  tasaNueva: string | null;
  variacionPct: string | null;
  /** Alerta de riesgo: la del evento. Alerta de tasa: no hay dato anterior, así que null. */
  calificacionAnterior: string | null;
  /** Alerta de riesgo: la del evento. Alerta de tasa: la vigente en sbs_risk_profiles (null si no hay). */
  calificacion: string | null;
  coberturaFSD: CoberturaFSD;
  leida: boolean;
  /** Cuándo entró a la cola (ISO 8601). */
  creadaEn: string;
}

/** Fila ya leída de la base, todavía sin formatear. */
export interface FilaAlerta {
  id: number;
  event: AlertEvent;
  creadaEn: string;
  leida: boolean;
  /** null si la entidad del evento no existe en el catálogo. */
  entidad: string | null;
  /** JSON tal como está en financial_entities.fsd_coverage. */
  fsdCoverage: string | null;
  calificacionActual: string | null;
}

export interface RepositorioAlertas {
  /** Alertas inmediatas del usuario, de la más reciente a la más antigua. */
  listarPorUsuario(userId: number): FilaAlerta[];
  /** false si la alerta no existe o no es de ese usuario. Marcar dos veces no es un error. */
  marcarLeida(userId: number, id: number, ahora: string): boolean;
}
