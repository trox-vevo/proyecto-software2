// US17/US18 — Patrón Specification: cada criterio de filtro es un objeto independiente con la
// misma interfaz. applyFilters los combina (AND) sin conocer cada filtro; US20 puede extenderlo.
// Se filtra en el cliente, sobre los resultados ya recibidos: no se vuelve a llamar al backend.

export type InstrumentType = "SAVINGS" | "FIXED_DEPOSIT";

/** Lo mínimo que un filtro necesita de un resultado (ahorros o plazo fijo). */
export interface SimulationResultDto {
  /** Solo en ahorros (US17). String con 2 decimales, ej. "5.00". */
  monthlyMaintenanceFee?: string;
  /** Misma forma en los dos endpoints (US18). */
  channels: { hasPhysicalBranches: boolean; hasAtms: boolean };
}

// Interfaz común: acordarla con el responsable de US20
export interface ResultFilter {
  id: string;
  /** Texto visible (lenguaje ubicuo). */
  label: string;
  appliesTo: InstrumentType[];
  apply(result: SimulationResultDto): boolean;
}

export const noMaintenanceFeeFilter: ResultFilter = {
  id: "no-maintenance-fee",
  label: "Sin costo de mantenimiento",
  appliesTo: ["SAVINGS"],
  // Number() y no comparar con "0.00": "0" y "0.0" también son costo cero (CLAUDE.md §2)
  apply: (r) => r.monthlyMaintenanceFee !== undefined && Number(r.monthlyMaintenanceFee) === 0,
};

export const hasPhysicalBranchesFilter: ResultFilter = {
  id: "has-physical-branches",
  label: "Con agencias físicas",
  appliesTo: ["SAVINGS", "FIXED_DEPOSIT"],
  apply: (r) => r.channels.hasPhysicalBranches,
};

export const hasAtmsFilter: ResultFilter = {
  id: "has-atms",
  label: "Con cajeros disponibles",
  appliesTo: ["SAVINGS", "FIXED_DEPOSIT"],
  apply: (r) => r.channels.hasAtms,
};

/** En el orden en que se muestran las casillas. */
export const ALL_FILTERS = [noMaintenanceFeeFilter, hasPhysicalBranchesFilter, hasAtmsFilter];

/** Combinación mínima (AND). Genérica para conservar el tipo de fila de cada tabla. */
export const applyFilters = <T extends SimulationResultDto>(results: T[], active: ResultFilter[]): T[] =>
  results.filter((r) => active.every((f) => f.apply(r)));
