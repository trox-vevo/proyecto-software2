import { useState } from "react";
import { applyFilters } from "./filters/resultFilters";
import { ResultFiltersPanel } from "./filters/ResultFiltersPanel";
import { useResultFilters } from "./filters/useResultFilters";
import { FormularioInversion } from "./inversiones/FormularioInversion";
import type { TipoInstrumento } from "./inversiones/FormularioInversion";
import { ProfileEditor } from "./profile/ProfileEditor";
import { PanelBloqueos } from "./monitor/PanelBloqueos";
import { useMonitorBloqueos } from "./monitor/useMonitorBloqueos";
import { RegistrationRoute } from "./registration/RegistrationRoute";
import { COLUMNAS } from "./tabla_ahorros/columnas";
import { TablaAhorrosView } from "./tabla_ahorros/TablaAhorrosView";
import { useTablaAhorrosController } from "./tabla_ahorros/useTablaAhorrosController";
import "./App.css";

export default function App() {
  return (
    <RegistrationRoute>
      <FinanceApp />
    </RegistrationRoute>
  );
}

function FinanceApp() {
  const [tipoInstrumento, setTipoInstrumento] =
    useState<TipoInstrumento>("AHORROS");
  const tabla = useTablaAhorrosController();
  const monitor = useMonitorBloqueos(tabla.vista);
  const filtros = useResultFilters("SAVINGS");
  const filasVisibles = applyFilters(tabla.filas, filtros.active);
  const estado =
    tabla.estado === "CON_DATOS" && filasVisibles.length === 0
      ? "VACIO"
      : tabla.estado;

  return (
    <main className="pagina">
      <h1>Yupay Finance</h1>
      <ProfileEditor />
      <FormularioInversion
        tipoInstrumento={tipoInstrumento}
        onTipoInstrumentoChange={setTipoInstrumento}
      />
      {tipoInstrumento === "AHORROS" && (
        <section aria-labelledby="titulo-resultados-ahorros">
          <h2 id="titulo-resultados-ahorros">Cuentas de ahorro disponibles</h2>
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
        </section>
      )}
      <PanelBloqueos eventos={monitor.eventos} umbralMs={monitor.umbralMs} />
    </main>
  );
}
