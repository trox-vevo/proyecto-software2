import type { NivelRiesgo } from "./tipos";

export interface ConfigNivel {
  etiqueta: string;
  /** Variable CSS definida en semaforo.css. Para cambiar un color se edita solo allí. */
  colorVar: string;
  /** Texto provisional del panel; se reemplaza cuando el equipo defina las descripciones reales. */
  descripcion: string;
}

export const CONFIG_NIVELES: Record<NivelRiesgo, ConfigNivel> = {
  VERDE: {
    etiqueta: "Riesgo bajo",
    colorVar: "var(--semaforo-verde)",
    descripcion: "Descripción provisional: la entidad muestra indicadores de solvencia saludables.",
  },
  AMARILLO: {
    etiqueta: "Riesgo medio",
    colorVar: "var(--semaforo-amarillo)",
    descripcion: "Descripción provisional: algunos indicadores de solvencia requieren atención.",
  },
  ROJO: {
    etiqueta: "Riesgo alto",
    colorVar: "var(--semaforo-rojo)",
    descripcion: "Descripción provisional: los indicadores de solvencia muestran un riesgo elevado.",
  },
};

/** Se usa cuando riesgo es null: no se pudo clasificar. */
export const CONFIG_SIN_CLASIFICAR: ConfigNivel = {
  etiqueta: "Sin clasificar",
  colorVar: "var(--semaforo-sin-clasificar)",
  descripcion: "Descripción provisional: no hay datos suficientes para clasificar el riesgo de esta cuenta.",
};

export function obtenerConfig(nivel: NivelRiesgo | null): ConfigNivel {
  return nivel === null ? CONFIG_SIN_CLASIFICAR : CONFIG_NIVELES[nivel];
}
