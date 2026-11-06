import { useState } from "react";
import { ALL_FILTERS, type InstrumentType, type ResultFilter } from "./resultFilters";

/**
 * Estado de los filtros activos para el instrumento elegido.
 * Al cambiar de instrumento, los filtros que no aplican se DESACTIVAN (se quitan del estado),
 * no solo se ocultan: así no queda un filtro invisible escondiendo resultados (CLAUDE.md §7).
 */
export function useResultFilters(instrument: InstrumentType) {
  const [active, setActive] = useState<ResultFilter[]>([]);
  const [previousInstrument, setPreviousInstrument] = useState(instrument);

  // Ajuste de estado durante el render al cambiar la prop (patrón recomendado por React)
  if (instrument !== previousInstrument) {
    setPreviousInstrument(instrument);
    setActive(active.filter((f) => f.appliesTo.includes(instrument)));
  }

  const toggle = (filter: ResultFilter) =>
    setActive((current) => (current.includes(filter) ? current.filter((f) => f !== filter) : [...current, filter]));

  return {
    available: ALL_FILTERS.filter((f) => f.appliesTo.includes(instrument)),
    active,
    toggle,
  };
}
