import { useEffect, useState } from "react";
import { MonitorBloqueosUI } from "./MonitorBloqueosUI";
import type { EventoBloqueo, VistaObservable } from "./tipos";

const UMBRAL_POR_DEFECTO_MS = 2000;
const INTERVALO_REVISION_MS = 250;

/** Para probar el monitor se puede bajar el umbral: http://localhost:5173/?umbral=1 */
function leerUmbral(): number {
  const valor = Number(new URLSearchParams(window.location.search).get("umbral"));
  return Number.isFinite(valor) && valor > 0 ? valor : UMBRAL_POR_DEFECTO_MS;
}

/** Conecta un MonitorBloqueosUI con una vista y lo hace revisar cada cierto tiempo. */
export function useMonitorBloqueos(vista: VistaObservable) {
  const [monitor] = useState(() => new MonitorBloqueosUI(leerUmbral(), "TablaAhorrosView"));
  const [eventos, setEventos] = useState<EventoBloqueo[]>([]);

  useEffect(() => {
    monitor.observar(vista);
    const intervalo = setInterval(() => {
      monitor.revisar();
      const actuales = monitor.obtenerEventos();
      setEventos((anteriores) => (anteriores.length === actuales.length ? anteriores : actuales));
    }, INTERVALO_REVISION_MS);
    return () => clearInterval(intervalo);
  }, [monitor, vista]);

  return { eventos, umbralMs: monitor.getUmbralMs() };
}
