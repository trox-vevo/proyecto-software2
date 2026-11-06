import type { FilaAhorro } from "../tabla_ahorros/tipos";

/** Mismos valores que el enum RiskLevel del backend (risk/domain/RiskLevel.ts). */
export type NivelRiesgo = "VERDE" | "AMARILLO" | "ROJO";

/** Clasificación de riesgo de una cuenta. */
export interface Riesgo {
  nivel: NivelRiesgo;
  /** Texto del panel desplegable. Si el backend no lo envía se usa el de configSemaforo.ts. */
  descripcion?: string;
}

/**
 * Fila de la tabla + su riesgo.
 * riesgo = null significa "el backend no pudo clasificar": no es un cuarto nivel (ver RiskLevel.ts).
 */
export interface FilaConRiesgo extends FilaAhorro {
  riesgo: Riesgo | null;
}
