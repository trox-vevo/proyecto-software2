import { useEffect, useRef, useState } from "react";
import type { VistaObservable } from "../monitor/tipos";
import type { ColumnaTabla, CriterioOrden, EstadoTabla, FilaAhorro } from "./tipos";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const DIAS = 365;

interface Consulta {
  criterio: CriterioOrden;
}

interface Carga {
  consulta: Consulta;
  filas: FilaAhorro[];
  error?: string;
}

interface Marcas {
  inicioCargaMs: number;
  finCargaMs: number | null;
  renderListoMs: number | null;
}

interface ResultadoFSD {
  cuentaId: string;
  coberturaFSD: {
    estado: "CUBIERTO" | "NO_CUBIERTO" | "NO_VERIFICADO";
  };
}

export function useTablaAhorrosController() {
  const [consulta, setConsulta] = useState<Consulta>({ criterio: "RENTABILIDAD" });
  const [carga, setCarga] = useState<Carga | null>(null);
  const marcas = useRef<Marcas>({
    inicioCargaMs: 0,
    finCargaMs: null,
    renderListoMs: null
  });
  const estadoRef = useRef<EstadoTabla>("CARGANDO");

  useEffect(() => {
    const controlador = new AbortController();

    const parametros = new URLSearchParams({
      dias: String(DIAS),
      criterio: consulta.criterio
    });

    marcas.current = {
      inicioCargaMs: performance.now(),
      finCargaMs: null,
      renderListoMs: null
    };

    fetch(`${API_URL}/api/ahorros/rentabilidad?${parametros}`, {
      signal: controlador.signal
    })
      .then(async (respuesta) => {
        if (!respuesta.ok) {
          const cuerpo = await respuesta.json().catch(() => null);
          throw new Error(
            cuerpo?.error ?? `El servidor respondió con el código ${respuesta.status}`
          );
        }

        return (await respuesta.json()) as {
          resultados: FilaAhorro[];
        };
      })
      .then(async (datos) => {
        if (controlador.signal.aborted) return;

        let filas: FilaAhorro[] = datos.resultados.map((fila) => ({
          ...fila,
          coberturaFSD: "Sin datos FSD"
        }));

        try {
          const respuestaFSD = await fetch(`${API_URL}/api/fsd/coberturas`, {
            signal: controlador.signal
          });

          if (!respuestaFSD.ok) {
            throw new Error("No se pudo consultar la cobertura FSD");
          }

          const datosFSD = (await respuestaFSD.json()) as {
            resultados: ResultadoFSD[];
          };

          const coberturas = new Map(
            datosFSD.resultados.map((item) => [
              item.cuentaId,
              item.coberturaFSD.estado
            ])
          );

          filas = datos.resultados.map((fila) => {
            const estado = coberturas.get(fila.cuentaId);

            let coberturaFSD = "Sin datos FSD";

            if (estado === "CUBIERTO") {
              coberturaFSD = "✓ Cubierta";
            } else if (estado === "NO_CUBIERTO") {
              coberturaFSD = "✕ No cubierta";
            } else if (estado === "NO_VERIFICADO") {
              coberturaFSD = "? No verificada";
            }

            return {
              ...fila,
              coberturaFSD
            };
          });
        } catch (error) {
          if (controlador.signal.aborted) return;

          console.warn(
            "No se pudo cargar la información FSD",
            error
          );
        }

        if (controlador.signal.aborted) return;

        marcas.current.finCargaMs = performance.now();

        setCarga({
          consulta,
          filas
        });
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

        setCarga({
          consulta,
          filas: [],
          error: mensaje
        });
      });

    return () => controlador.abort();
  }, [consulta]);

  let estado: EstadoTabla;

  if (carga === null || carga.consulta !== consulta) {
    estado = "CARGANDO";
  } else if (carga.error !== undefined) {
    estado = "ERROR";
  } else if (carga.filas.length === 0) {
    estado = "VACIO";
  } else {
    estado = "CON_DATOS";
  }

  useEffect(() => {
    estadoRef.current = estado;
  });

  useEffect(() => {
    if (carga !== null && carga.consulta === consulta) {
      marcas.current.renderListoMs = performance.now();
    }
  }, [carga, consulta]);

  const [vista] = useState<VistaObservable>(() => ({
    obtenerInstantanea: () => ({
      estado: estadoRef.current,
      ...marcas.current
    })
  }));

  function onOrdenar(columna: ColumnaTabla) {
    const criterio = columna.criterio;

    if (criterio === undefined) return;

    setConsulta((actual) =>
      actual.criterio === criterio
        ? actual
        : { criterio }
    );
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
    reintentar
  };
}
