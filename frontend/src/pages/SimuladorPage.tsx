import { useAbrirGlosario } from "../app/glosario";
import { navegar } from "../app/navegacion";
import { applyFilters } from "../filters/resultFilters";
import { ResultFiltersPanel } from "../filters/ResultFiltersPanel";
import { useResultFilters } from "../filters/useResultFilters";
import { FormularioInversion, type TipoInstrumento } from "../inversiones/FormularioInversion";
import { PlazoFijoView } from "../plazo_fijo/PlazoFijoView";
import type { ParametrosPlazoFijo } from "../plazo_fijo/tipos";
import { COLUMNAS } from "../tabla_ahorros/columnas";
import { TablaAhorrosView } from "../tabla_ahorros/TablaAhorrosView";
import { useTablaAhorrosController } from "../tabla_ahorros/useTablaAhorrosController";

const RUTA_SIMULADOR: Record<TipoInstrumento, string> = {
  AHORROS: "/simular/ahorros",
  PLAZO_FIJO: "/simular/plazo-fijo",
};

const TITULO: Record<TipoInstrumento, string> = {
  AHORROS: "Simula tu cuenta de ahorros",
  PLAZO_FIJO: "Simula tu depósito a plazo fijo",
};

/**
 * Pantallas /simular/ahorros y /simular/plazo-fijo (antes FinanceApp).
 * Es un solo componente a propósito: al cambiar de instrumento React lo conserva montado,
 * así no se pierden los parámetros de plazo fijo ni los resultados de ahorros al alternar.
 * US04: el selector de instrumento se mantiene y navega a la pantalla del otro instrumento.
 */
export function SimuladorPage({
  instrumento,
  savingsReplay,
  fixedReplay,
}: {
  instrumento: TipoInstrumento;
  savingsReplay?: { accountId: string; days: number };
  fixedReplay?: { id: number; parameters: ParametrosPlazoFijo };
}) {
  const abrirGlosario = useAbrirGlosario();
  const tabla = useTablaAhorrosController(savingsReplay);
  // US17/US18: se filtra en el cliente sobre las filas ya recibidas (sin nueva petición).
  // "SAVINGS" fijo: los filtros solo se muestran en la sección de ahorros.
  const filtros = useResultFilters("SAVINGS");
  const filasVisibles = applyFilters(tabla.filas, filtros.active);
  // Si los filtros dejan 0 filas, la tabla muestra su zero-state
  const estado = tabla.estado === "CON_DATOS" && filasVisibles.length === 0 ? "VACIO" : tabla.estado;
  const verPlanes = () => navegar("/planes");

  return (
    <main className="pagina">
      <h1>{TITULO[instrumento]}</h1>
      <FormularioInversion
        plazoFijo={<PlazoFijoView onViewPlans={verPlanes} replay={fixedReplay} />}
        tipoInstrumento={instrumento}
        onTipoInstrumentoChange={(tipo) => navegar(RUTA_SIMULADOR[tipo])}
        onBuscarAhorros={tabla.buscar}
      />
      {instrumento === "AHORROS" && (
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
            favoritos={{ days: tabla.dias, onViewPlans: verPlanes }}
            onConsultarTermino={abrirGlosario}
          />
        </section>
      )}
    </main>
  );
}
