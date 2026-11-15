import { PlazoFijoView } from "./plazo_fijo/PlazoFijoView";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { ProfileEditor } from "./profile/ProfileEditor";
import { RegistrationRoute } from "./registration/RegistrationRoute";
import { PlanComparison } from "./commerce/PlanComparison";
import { Checkout } from "./commerce/Checkout";
import { SubscriptionStatusBanner } from "./commerce/SubscriptionStatusBanner";
import "./commerce/commerce.css";
import { GlosarioFinanciero } from "./glosario/GlosarioFinanciero";
import { SavedSimulations, type FavoriteParameters } from "./commerce/SavedSimulations";
import { BillingHistory } from "./commerce/BillingHistory";
import { AlertasSeccion } from "./alertas/AlertasSeccion";

export default function App() {
  return <RegistrationRoute><CommerceApp /></RegistrationRoute>;
}

function CommerceApp() {
  const [path, setPath] = useState(window.location.pathname);
  const [replayRequest, setReplayRequest] = useState<{ id: number; parameters: FavoriteParameters }>();
  const replaySequence = useRef(0);
  useEffect(() => {
    const onPopState = () => {
      setReplayRequest(undefined);
      setPath(window.location.pathname);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(next: string, preserveReplay = false) {
    if (!preserveReplay) setReplayRequest(undefined);
    window.history.pushState(null, "", next);
    setPath(next);
  }

  function volverASimular(parameters: FavoriteParameters) {
    replaySequence.current += 1;
    setReplayRequest({ id: replaySequence.current, parameters });
    navigate("/", true);
  }

  return <>
    <nav className="comercio-nav" aria-label="Navegación principal">
      <a href="/" aria-current={path === "/" ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/"); }}>Inicio</a>
      <a href="/planes" aria-current={path === "/planes" ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/planes"); }}>Planes</a>
      <a href="/favoritos" aria-current={path === "/favoritos" ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/favoritos"); }}>Mis favoritos</a>
      <a href="/facturacion" aria-current={path === "/facturacion" ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/facturacion"); }}>Facturación</a>
      <a href="/perfil" aria-current={path === "/perfil" ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate("/perfil"); }}>Mi perfil</a>
    </nav>
    <SubscriptionStatusBanner />
    {path === "/planes" ? <PlanComparison onCheckout={() => navigate("/checkout")} />
      : path === "/checkout" ? <Checkout onViewPlans={() => navigate("/planes")} onReturnToApp={() => navigate("/")} />
      : path === "/favoritos" ? <main className="pagina">
        <button type="button" onClick={() => navigate("/")}>Volver al inicio</button>
        <SavedSimulations onReplay={volverASimular} onViewPlans={() => navigate("/planes")} />
      </main>
      : path === "/facturacion" ? <main className="pagina"><BillingHistory onReturn={() => navigate("/")} /></main>
      : path === "/perfil" ? <main className="pagina">
        <button type="button" onClick={() => navigate("/")}>Volver al inicio</button>
        <ProfileEditor onViewBillingHistory={() => navigate("/facturacion")} />
        <AlertasSeccion />
      </main>
      : <FinanceApp onViewPlans={() => navigate("/planes")} onViewProfile={() => navigate("/perfil")} replay={replayRequest} />}
  </>;
}

function FinanceApp({
  onViewPlans,
  onViewProfile,
  replay,
}: {
  onViewPlans: () => void;
  onViewProfile: () => void;
  replay?: { id: number; parameters: FavoriteParameters };
}) {
  const [glosario, setGlosario] = useState<{ termino: string | null } | null>(null);
  const cerrarGlosario = useCallback(() => setGlosario(null), []);
  const [tipoInstrumento, setTipoInstrumento] = useState<TipoInstrumento>(
    replay?.parameters.instrument === "PLAZO_FIJO" ? "PLAZO_FIJO" : "AHORROS",
  );
  const savingsReplay = replay?.parameters.instrument === "AHORROS"
    ? { accountId: replay.parameters.accountId, days: replay.parameters.days }
    : undefined;
  const tabla = useTablaAhorrosController(savingsReplay);
  const fixedReplay = replay?.parameters.instrument === "PLAZO_FIJO"
    ? {
      id: replay.id,
      parameters: {
        amount: replay.parameters.amount,
        department: replay.parameters.department,
        paymentMode: replay.parameters.paymentMode,
        termDays: replay.parameters.termDays,
      },
    }
    : undefined;
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
      <button className="boton-mi-perfil" type="button" onClick={onViewProfile}>Mi perfil</button>
      <div className="glosario-enlaces">
        <button className="glosario-enlace" type="button" onClick={() => setGlosario({ termino: null })}>Glosario financiero</button>
        <span>Consulta:</span>
        {["TEA", "TREA", "Rentabilidad", "Depósito a plazo fijo"].map((termino) => <button className="glosario-enlace" key={termino} type="button" onClick={() => setGlosario({ termino })}>{termino}</button>)}
      </div>
      <FormularioInversion
        plazoFijo={<PlazoFijoView onViewPlans={onViewPlans} replay={fixedReplay} />}
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
            onConsultarTermino={(termino) => setGlosario({ termino })}
          />
        </section>
      )}
      <PanelBloqueos eventos={monitor.eventos} umbralMs={monitor.umbralMs} />
      <GlosarioFinanciero abierto={glosario !== null} terminoSeleccionado={glosario?.termino ?? null} onCerrar={cerrarGlosario} />
    </main>
  );
}
