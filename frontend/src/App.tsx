import { useEffect, useState } from "react";
import { applyFilters } from "./filters/resultFilters";
import { ResultFiltersPanel } from "./filters/ResultFiltersPanel";
import { useResultFilters } from "./filters/useResultFilters";
import { FormularioInversion } from "./inversiones/FormularioInversion";
import type { TipoInstrumento } from "./inversiones/FormularioInversion";
import { PanelBloqueos } from "./monitor/PanelBloqueos";
import { useMonitorBloqueos } from "./monitor/useMonitorBloqueos";
import { COLUMNAS } from "./tabla_ahorros/columnas";
import { TablaAhorrosView } from "./tabla_ahorros/TablaAhorrosView";
import { useTablaAhorrosController } from "./tabla_ahorros/useTablaAhorrosController";
import "./App.css";
import { PlanComparison } from "./commerce/PlanComparison";
import { Checkout } from "./commerce/Checkout";
import "./commerce/commerce.css";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(next: string) {
    window.history.pushState(null, "", next);
    setPath(next);
  }

  return <>
    <nav className="comercio-nav" aria-label="Navegación principal">
      <a href="/" aria-current={path === "/" ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/"); }}>Inicio</a>
      <a href="/planes" aria-current={path === "/planes" ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/planes"); }}>Planes</a>
    </nav>
    {path === "/planes" ? <PlanComparison onCheckout={() => navigate("/checkout")} />
      : path === "/checkout" ? <Checkout onViewPlans={() => navigate("/planes")} onReturnToApp={() => navigate("/")} />
        : <FinanceApp onViewPlans={() => navigate("/planes")} />}
  </>;
}

function FinanceApp({ onViewPlans }: { onViewPlans: () => void }) {
  const [tipoInstrumento, setTipoInstrumento] =
    useState<TipoInstrumento>("AHORROS");
  const tabla = useTablaAhorrosController();
  const monitor = useMonitorBloqueos(tabla.vista);
  // US17/US18: se filtra en el cliente sobre las filas ya recibidas (sin nueva petición).
  // "SAVINGS" fijo: los filtros solo se muestran en la sección de ahorros.
  const filtros = useResultFilters("SAVINGS");
  const filasVisibles = applyFilters(tabla.filas, filtros.active);
  // Si los filtros dejan 0 filas, la tabla muestra su zero-state
  const estado = tabla.estado === "CON_DATOS" && filasVisibles.length === 0 ? "VACIO" : tabla.estado;

  return (
    <main className="pagina">
      <h1>Yupay Finance</h1>
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
            favoritos={{ days: tabla.dias, onViewPlans }}
          />
        </section>
      )}
      <PanelBloqueos eventos={monitor.eventos} umbralMs={monitor.umbralMs} />
    </main>
  );
}
