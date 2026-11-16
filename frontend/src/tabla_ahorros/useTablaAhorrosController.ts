import { useCallback, useEffect, useRef, useState } from "react";
import type { VistaObservable } from "../monitor/tipos";
import { aplicarRiesgoMock } from "../semaforo/riesgoMock";
import type { FilaConRiesgo } from "../semaforo/tipos";
import { fetchWithAuth } from "../auth/session";
import type { ColumnaTabla, CriterioOrden, EstadoTabla, FilaAhorro } from "./tipos";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const DIAS = 365;

interface Consulta {
  criterio: CriterioOrden;
  days: number;
  accountId?: string;
  /** US08/US09: monto y departamento de la búsqueda (van juntos). */
  monto?: string;
  departamento?: string;
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
export function useTablaAhorrosController(initialReplay?: { accountId: string; days: number }) {
  // US08: sin favorito que repetir, no se consulta nada hasta que el usuario presiona "Buscar"
  const [consulta, setConsulta] = useState<Consulta | null>(() => initialReplay
    ? { criterio: "RENTABILIDAD", days: initialReplay.days, accountId: initialReplay.accountId }
    : null);
  const [carga, setCarga] = useState<Carga | null>(null);
  // Sin búsqueda no hay carga pendiente: finCargaMs no queda en null para que el monitor no la tome como bloqueo
  const marcas = useRef<Marcas>({ inicioCargaMs: 0, finCargaMs: initialReplay ? null : 0, renderListoMs: null });
  const estadoRef = useRef<EstadoTabla>(initialReplay ? "CARGANDO" : "SIN_BUSQUEDA");

  // cargarResultados(): se ejecuta cada vez que cambia la consulta (al buscar, ordenar o reintentar)
  useEffect(() => {
    if (consulta === null) return;
    const controlador = new AbortController();
    const parametros = new URLSearchParams({ dias: String(consulta.days), criterio: consulta.criterio });
    if (consulta.accountId) parametros.set("accountId", consulta.accountId);
    if (consulta.monto !== undefined && consulta.departamento !== undefined) {
      parametros.set("monto", consulta.monto);
      parametros.set("departamento", consulta.departamento);
    }
    marcas.current = { inicioCargaMs: performance.now(), finCargaMs: null, renderListoMs: null };

    fetchWithAuth(`${API_URL}/api/ahorros/rentabilidad?${parametros}`, { signal: controlador.signal })
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
  if (consulta === null) estado = "SIN_BUSQUEDA";
  else if (carga === null || carga.consulta !== consulta) estado = "CARGANDO";
  else if (carga.error !== undefined) estado = "ERROR";
  else if (carga.filas.length === 0) estado = "VACIO";
  else estado = "CON_DATOS";

  useEffect(() => {
    estadoRef.current = estado;
  });

  // Cuando los datos de la consulta actual ya están dibujados, se anota la hora
  useEffect(() => {
    if (consulta !== null && carga !== null && carga.consulta === consulta) {
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
    setConsulta((actual) => (actual === null || actual.criterio === criterio ? actual : { ...actual, criterio }));
  }

  function reintentar() {
    setConsulta((actual) => (actual === null ? null : { ...actual }));
  }

  const volverASimular = useCallback((accountId: string, days: number) => {
    if (!Number.isSafeInteger(days) || days <= 0 || !accountId.trim()) return;
    setConsulta((actual) => (actual === null ? null : { ...actual, accountId, days }));
  }, []);

  /** US08: nueva búsqueda (objeto nuevo aunque se repitan los valores, para volver a pedir). */
  const buscar = useCallback((monto: string, departamento: string) => {
    setConsulta({ criterio: "RENTABILIDAD", days: DIAS, monto, departamento });
  }, []);

  return {
    estado,
    filas: carga?.filas ?? [],
    mensajeError: carga?.error,
    criterioActivo: consulta?.criterio ?? "RENTABILIDAD",
    dias: consulta?.days ?? DIAS,
    vista,
    onOrdenar,
    reintentar,
    volverASimular,
    buscar,
  };
}
