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
  /** US08/US09: búsqueda del formulario; sin ella se listan todas las cuentas con su saldo. */
  busqueda?: BusquedaAhorros;
}

/** Parámetros del formulario de ahorros (US06/US08). */
export interface BusquedaAhorros {
  monto: string;
  departamento: string;
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
  const [consulta, setConsulta] = useState<Consulta>(() => ({
    criterio: "RENTABILIDAD",
    days: initialReplay?.days ?? DIAS,
    ...(initialReplay ? { accountId: initialReplay.accountId } : {}),
  }));
  const [carga, setCarga] = useState<Carga | null>(null);
  const marcas = useRef<Marcas>({ inicioCargaMs: 0, finCargaMs: null, renderListoMs: null });
  const estadoRef = useRef<EstadoTabla>("CARGANDO");

  // cargarResultados(): se ejecuta al abrir la tabla y cada vez que cambia la consulta
  useEffect(() => {
    const controlador = new AbortController();
    const parametros = new URLSearchParams({ dias: String(consulta.days), criterio: consulta.criterio });
    if (consulta.accountId) parametros.set("accountId", consulta.accountId);
    if (consulta.busqueda) {
      parametros.set("monto", consulta.busqueda.monto);
      parametros.set("departamento", consulta.busqueda.departamento);
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
    setConsulta((actual) => (actual.criterio === criterio ? actual : { ...actual, criterio }));
  }

  function reintentar() {
    setConsulta((actual) => ({ ...actual }));
  }

  const volverASimular = useCallback((accountId: string, days: number) => {
    if (!Number.isSafeInteger(days) || days <= 0 || !accountId.trim()) return;
    // El replay de un favorito simula la cuenta guardada con su saldo: se descarta la búsqueda del formulario
    setConsulta((actual) => ({ ...actual, accountId, days, busqueda: undefined }));
  }, []);

  /** US08: nueva búsqueda con el monto y departamento del formulario (deja de lado el replay). */
  const buscar = useCallback((busqueda: BusquedaAhorros) => {
    setConsulta((actual) => ({ criterio: actual.criterio, days: actual.days, busqueda }));
  }, []);

  return {
    estado,
    filas: carga?.filas ?? [],
    mensajeError: carga?.error,
    criterioActivo: consulta.criterio,
    dias: consulta.days,
    vista,
    onOrdenar,
    reintentar,
    volverASimular,
    buscar,
    busqueda: consulta.busqueda,
  };
}
