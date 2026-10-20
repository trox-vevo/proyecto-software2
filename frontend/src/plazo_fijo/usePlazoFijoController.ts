import { useEffect, useRef, useState } from "react";
import { simularPlazoFijo } from "./api";
import type { ParametrosPlazoFijo, ResultadoPlazoFijo } from "./tipos";
import { validarParametros } from "./validacion";

interface Simulacion {
  parametros: ParametrosPlazoFijo;
  resultados: ResultadoPlazoFijo[];
}

/** TS-20: parámetros temporales y resultados pertenecen al mismo flujo React. */
export function usePlazoFijoController() {
  const [parametros, setParametros] = useState<ParametrosPlazoFijo>({
    amount: "", department: "Lima", paymentMode: "AT_MATURITY", termDays: 360,
  });
  const [simulacion, setSimulacion] = useState<Simulacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const solicitud = useRef<AbortController | null>(null);

  useEffect(() => () => solicitud.current?.abort(), []);

  function cambiarParametros(nuevos: ParametrosPlazoFijo) {
    solicitud.current?.abort();
    solicitud.current = null;
    setParametros(nuevos);
    setSimulacion(null);
    setError(null);
    setErrores([]);
    setCargando(false);
  }

  async function simular() {
    // US07: si el monto es menor a 500, mostramos el aviso y no llamamos al backend.
    const encontrados = validarParametros(parametros);
    setErrores(encontrados);
    if (encontrados.length > 0) return;

    solicitud.current?.abort();
    const controlador = new AbortController();
    solicitud.current = controlador;
    setCargando(true);
    setError(null);
    setSimulacion(null);
    try {
      const resultados = await simularPlazoFijo(parametros, controlador.signal);
      if (!controlador.signal.aborted) setSimulacion({ parametros, resultados });
    } catch (causa) {
      if (!controlador.signal.aborted) {
        setError(causa instanceof TypeError ? "No se pudo conectar con el servidor. Inténtalo de nuevo."
          : causa instanceof Error ? causa.message : "No se pudo realizar la simulación.");
      }
    } finally {
      if (!controlador.signal.aborted) {
        setCargando(false);
        solicitud.current = null;
      }
    }
  }

  return { parametros, cambiarParametros, simular, simulacion, cargando, error, errores };
}
