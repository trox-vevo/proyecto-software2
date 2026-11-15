import { useCallback, useMemo, useState } from "react";
import { alertasMock } from "./alertasMock";
import type { Alerta } from "./tipos";

/** Un enlace como /?alerta=3 abre directamente el detalle de esa alerta (lo usará el correo de US40). */
function idDesdeUrl(): number | null {
  const valor = new URLSearchParams(window.location.search).get("alerta");
  const id = Number(valor);
  return valor !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Estado de las alertas: lista, contador de pendientes y alerta abierta en el panel.
 * Hoy usa alertasMock(); cuando exista la API (US38/US39) se cambia solo la carga inicial
 * y panelMostrado() pasa a llamar al endpoint de TS-110, revirtiendo el cambio si falla.
 */
export function useAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>(() => alertasMock());
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(idDesdeUrl);

  // El contador se deduce de la lista: no hay un segundo número que pueda quedar desactualizado.
  const pendientes = useMemo(() => alertas.filter((alerta) => !alerta.leida).length, [alertas]);
  const seleccionada = useMemo(
    () => alertas.find((alerta) => alerta.id === seleccionadaId) ?? null,
    [alertas, seleccionadaId],
  );

  const abrirDetalle = useCallback((id: number) => setSeleccionadaId(id), []);
  const cerrarDetalle = useCallback(() => setSeleccionadaId(null), []);

  /** El panel avisa cuando ya se mostró: recién entonces la alerta se marca como leída (US36, escenario 2). */
  const panelMostrado = useCallback((id: number) => {
    setAlertas((actuales) =>
      actuales.map((alerta) => (alerta.id === id && !alerta.leida ? { ...alerta, leida: true } : alerta)),
    );
  }, []);

  return { alertas, pendientes, seleccionada, abrirDetalle, cerrarDetalle, panelMostrado };
}
