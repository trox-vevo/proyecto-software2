import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// Ajusta la ruta a donde esté session.ts en tu proyecto.
import { fetchWithAuth } from "../auth/session";
import type { Alerta } from "./tipos";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const URL_ALERTAS = `${API_URL}/api/alertas`;
const MENSAJE_SIN_SESION = "Inicia sesión para ver tus alertas.";
const MENSAJE_ERROR_CARGA = "No se pudieron cargar las alertas. Inténtalo de nuevo más tarde.";

/** Un enlace como /?alerta=3 abre directamente el detalle de esa alerta (lo usa el correo de US40). */
function idDesdeUrl(): number | null {
  const valor = new URLSearchParams(window.location.search).get("alerta");
  const id = Number(valor);
  return valor !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Estado de las alertas: lista (desde GET /api/alertas), contador de pendientes y alerta abierta en el panel.
 * Al mostrarse el detalle, la alerta se marca como leída en pantalla de inmediato y se guarda con
 * PATCH /api/alertas/:id/leida (TS-110). Si el guardado falla, el cambio se revierte.
 */
export function useAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(idDesdeUrl);
  // Alertas para las que ya se intentó guardar la lectura: evita repetir el PATCH en bucle si falla.
  const intentadas = useRef(new Set<number>());

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const respuesta = await fetchWithAuth(URL_ALERTAS);
        if (respuesta.status === 401) {
          if (activo) setError(MENSAJE_SIN_SESION);
          return;
        }
        if (!respuesta.ok) throw new Error("Respuesta no exitosa");
        const cuerpo = (await respuesta.json()) as { alertas?: unknown };
        if (!Array.isArray(cuerpo.alertas)) throw new Error("Respuesta inesperada");
        if (activo) setAlertas(cuerpo.alertas as Alerta[]);
      } catch {
        if (activo) setError(MENSAJE_ERROR_CARGA);
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  // El contador se deduce de la lista: no hay un segundo número que pueda quedar desactualizado.
  const pendientes = useMemo(() => alertas.filter((alerta) => !alerta.leida).length, [alertas]);
  const seleccionada = useMemo(
    () => alertas.find((alerta) => alerta.id === seleccionadaId) ?? null,
    [alertas, seleccionadaId],
  );

  const abrirDetalle = useCallback((id: number) => {
    intentadas.current.delete(id); // volver a abrirla permite reintentar un guardado que falló
    setSeleccionadaId(id);
  }, []);
  const cerrarDetalle = useCallback(() => setSeleccionadaId(null), []);

  const cambiarLeida = useCallback((id: number, leida: boolean) => {
    setAlertas((actuales) => actuales.map((alerta) => (alerta.id === id ? { ...alerta, leida } : alerta)));
  }, []);

  /** El panel avisa cuando ya se mostró: recién entonces la alerta se marca como leída (US36, escenario 2). */
  const panelMostrado = useCallback(
    (id: number) => {
      const alerta = alertas.find((candidata) => candidata.id === id);
      if (!alerta || alerta.leida || intentadas.current.has(id)) return;
      intentadas.current.add(id);
      cambiarLeida(id, true);
      void (async () => {
          const guardada = await fetchWithAuth(`${URL_ALERTAS}/${id}/leida`, { method: "PATCH" }).then(
          (respuesta) => respuesta.ok,
          () => false,
        );
        if (!guardada) cambiarLeida(id, false);
      })();
    },
    [alertas, cambiarLeida],
  );

  return { alertas, pendientes, cargando, error, seleccionada, abrirDetalle, cerrarDetalle, panelMostrado };
}
