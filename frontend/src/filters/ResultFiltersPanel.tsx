import type { ResultFilter } from "./resultFilters";
import "./ResultFiltersPanel.css";

interface Props {
  available: ResultFilter[];
  active: ResultFilter[];
  onToggle: (filter: ResultFilter) => void;
  visibleCount: number;
  totalCount: number;
}

/** Casillas de filtro independientes (US17/US18) y el contador "Mostrando X de Y opciones". */
export function ResultFiltersPanel({ available, active, onToggle, visibleCount, totalCount }: Props) {
  return (
    <div className="filtros">
      <fieldset>
        <legend>Filtrar resultados</legend>
        {available.map((filter) => (
          <label key={filter.id}>
            <input type="checkbox" checked={active.includes(filter)} onChange={() => onToggle(filter)} />
            {filter.label}
          </label>
        ))}
      </fieldset>
      <p role="status">
        Mostrando {visibleCount} de {totalCount} opciones
      </p>
    </div>
  );
}
