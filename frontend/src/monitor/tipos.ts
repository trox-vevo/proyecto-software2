import type { EstadoTabla } from "../tabla_ahorros/tipos";

/** Tipos de bloqueo que detecta el monitor. */
export type TipoBloqueo = "RENDER_LENTO" | "SIN_RESPUESTA" | "ERROR_CARGA";

export interface EventoBloqueo {
  readonly tipo: TipoBloqueo;
  readonly momento: Date;
  readonly duracionMs: number;
  readonly componente: string;
}

/** Foto de la vista en un instante: su estado y los tiempos (en ms) de la última carga. */
export interface InstantaneaVista {
  estado: EstadoTabla;
  /** Cuándo empezó a pedir los datos. */
  inicioCargaMs: number;
  /** Cuándo llegó la respuesta (o falló). null mientras sigue esperando. */
  finCargaMs: number | null;
  /** Cuándo la tabla ya estaba dibujada con esos datos. null si aún no. */
  renderListoMs: number | null;
}

/** Lo único que el monitor necesita saber de una vista para poder vigilarla. */
export interface VistaObservable {
  obtenerInstantanea(): InstantaneaVista;
}
