import { useEffect, useRef, useState } from "react";
import type { VistaObservable } from "../monitor/tipos";
import { aplicarRiesgoMock } from "../semaforo/riesgoMock";
import type { FilaConRiesgo } from "../semaforo/tipos";
import type { ColumnaTabla, CriterioOrden, EstadoTabla, FilaAhorro } from "./tipos";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const DIAS = 365;

interface Consulta {
  criterio: CriterioOrden;
}

interface Carga {
  consulta: Consulta;
  filas: FilaConRiesgo[];
  error?: string;
}

/** Tiempos de la última carga, que el monitor de bloqueos usa para vigilar la vista. */
interface Marcas {
  inicioCargaMs: number;
  finCargaMs: number | null;
  renderListoMs: number | null;
}

/** Controlador de la tabla: pide los datos al backend y decide en qué estado está la vista. */
export function useTablaAhorrosController() {
  const [consulta, setConsulta] = useState<Consulta>({ criterio: "RENTABILIDAD" });
  const [carga, setCarga] = useState<Carga | null>(null);
  const marcas = useRef<Marcas>({ inicioCargaMs: 0, finCargaMs: null, renderListoMs: null });
  const estadoRef = useRef<EstadoTabla>("CARGANDO");

  // cargarResultados(): se ejecuta al abrir la tabla y cada vez que cambia la consulta
  useEffect(() => {
    const controlador = new AbortController();
    const parametros = new URLSearchParams({ dias: String(DIAS), criterio: consulta.criterio });
    marcas.current = { inicioCargaMs: performance.now(), finCargaMs: null, renderListoMs: null };

    fetch(`${API_URL}/api/ahorros/rentabilidad?${parametros}`, { signal: controlador.signal })
      .then(async (respuesta) => {
        if (!respuesta.ok) {
          const cuerpo = await respuesta.json().catch(() => null);
          throw new Error(cuerpo?.error ?? `El servidor respondió con el código ${respuesta.status}`);
        }
        return (await respuesta.json()) as { resultados: FilaAhorro[] };
      })
      .then((datos) => {
        if (controlador.signal.aborted) return;
        marcas.current.finCargaMs = performance.now();
          setCarga({ consulta, filas: aplicarRiesgoMock(datos.resultados) });
      })
      .catch((error: unknown) => {
        if (controlador.signal.aborted) return;
        marcas.current.finCargaMs = performance.now();
        const mensaje =
          error instanceof TypeError
            ? "No se pudo conectar con el servidor"
            : error instanceof Error
              ? error.message
              : "Error desconocido";
        setCarga({ consulta, filas: [], error: mensaje });
      });

    return () => controlador.abort();
  }, [consulta]);

  // El estado se deduce: si la carga no corresponde a la consulta actual, todavía está cargando
  let estado: EstadoTabla;
  if (carga === null || carga.consulta !== consulta) estado = "CARGANDO";
  else if (carga.error !== undefined) estado = "ERROR";
  else if (carga.filas.length === 0) estado = "VACIO";
  else estado = "CON_DATOS";

  useEffect(() => {
    estadoRef.current = estado;
  });

  // Cuando los datos de la consulta actual ya están dibujados, se anota la hora
  useEffect(() => {
    if (carga !== null && carga.consulta === consulta) {
      marcas.current.renderListoMs = performance.now();
    }
  }, [carga, consulta]);

  // Lo que el monitor de bloqueos puede mirar de esta vista
  const [vista] = useState<VistaObservable>(() => ({
    obtenerInstantanea: () => ({ estado: estadoRef.current, ...marcas.current }),
  }));

  function onOrdenar(columna: ColumnaTabla) {
    const criterio = columna.criterio;
    if (criterio === undefined) return;
    setConsulta((actual) => (actual.criterio === criterio ? actual : { criterio }));
  }

  function reintentar() {
    setConsulta((actual) => ({ ...actual }));
  }

  return {
    estado,
    filas: carga?.filas ?? [],
    mensajeError: carga?.error,
    criterioActivo: consulta.criterio,
    vista,
    onOrdenar,
    reintentar,
  };
}
