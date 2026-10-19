import { applyFilters } from "./filters/resultFilters";
import { ResultFiltersPanel } from "./filters/ResultFiltersPanel";
import { useResultFilters } from "./filters/useResultFilters";
import { PanelBloqueos } from "./monitor/PanelBloqueos";
import { useMonitorBloqueos } from "./monitor/useMonitorBloqueos";
import { COLUMNAS } from "./tabla_ahorros/columnas";
import { TablaAhorrosView } from "./tabla_ahorros/TablaAhorrosView";
import { useTablaAhorrosController } from "./tabla_ahorros/useTablaAhorrosController";
import "./App.css";

export default function App() {
  const tabla = useTablaAhorrosController();
  const monitor = useMonitorBloqueos(tabla.vista);
  // US17/US18: se filtra en el cliente sobre las filas ya recibidas (sin nueva petición).
  // "SAVINGS" fijo hasta que exista el selector de instrumento (US04).
  const filtros = useResultFilters("SAVINGS");
  const filasVisibles = applyFilters(tabla.filas, filtros.active);
  // Si los filtros dejan 0 filas, la tabla muestra su zero-state
  const estado = tabla.estado === "CON_DATOS" && filasVisibles.length === 0 ? "VACIO" : tabla.estado;

  return (
    <main className="pagina">
      <h1>Cuentas de ahorro</h1>
      {tabla.estado === "CON_DATOS" && (
        <ResultFiltersPanel
          available={filtros.available}
          active={filtros.active}
          onToggle={filtros.toggle}
          visibleCount={filasVisibles.length}
          totalCount={tabla.filas.length}
        />
      )}
      <TablaAhorrosView
        columnas={COLUMNAS}
        filas={filasVisibles}
        estado={estado}
        mensajeError={tabla.mensajeError}
        criterioActivo={tabla.criterioActivo}
        onOrdenar={tabla.onOrdenar}
        onReintentar={tabla.reintentar}
      />
      <PanelBloqueos eventos={monitor.eventos} umbralMs={monitor.umbralMs} />
    </main>
  );
}
