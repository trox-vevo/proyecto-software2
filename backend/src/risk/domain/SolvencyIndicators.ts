import type Decimal from "decimal.js";

/** Evidencia de un indicador; su autenticidad debe comprobarse al incorporar la fuente. */
export interface SolvencyIndicator {
  readonly value: Decimal;
  readonly unit: string;
  readonly sourceUrl: string;
  /** Fecha de referencia del indicador en formato ISO 8601. */
  readonly observedAt: string;
}

/** TS-66: nombres y unidades se definirán con el equipo; no se deducen de la TEA. */
export interface SolvencyIndicators {
  /** Identificador estable de la entidad, no del producto ni su nombre visible. */
  readonly entityId: string;
  readonly values: ReadonlyMap<string, SolvencyIndicator>;
}
