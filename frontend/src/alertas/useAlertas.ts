import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const CLAVE_PENDIENTE = "yupay.alerta.pendiente";

function leerIdPendiente(): number | null {
  try {
    const valor = sessionStorage.getItem(CLAVE_PENDIENTE);
    const id = Number(valor);
    return valor !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function guardarIdPendiente(id: number | null): void {
  try {
    if (id === null) sessionStorage.removeItem(CLAVE_PENDIENTE);
    else sessionStorage.setItem(CLAVE_PENDIENTE, String(id));
  } catch {
    /* sin almacenamiento disponible */
  }
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
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(() => idDesdeUrl() ?? leerIdPendiente());
  // Alertas para las que ya se intentó guardar la lectura: evita repetir el PATCH en bucle si falla.
  const intentadas = useRef(new Set<number>());
  const lecturasEnCurso = useRef(new Set<number>());
  const revisionLecturas = useRef(0);
  // Si el enlace llegó sin sesión, se recuerda la alerta para abrirla después de iniciar sesión.
  useEffect(() => {
    const id = idDesdeUrl();
    if (id !== null) guardarIdPendiente(id);
  }, []);

  useEffect(() => {
    let activo = true;
    let consultando = false;
    const controlador = new AbortController();
    const cargar = async () => {
      if (consultando || lecturasEnCurso.current.size) return;
      consultando = true;
      const revision = revisionLecturas.current;
      try {
        const respuesta = await fetchWithAuth(URL_ALERTAS, { signal: controlador.signal });
        if (respuesta.status === 401) {
          if (activo) setError(MENSAJE_SIN_SESION);
          return;
        }
        if (!respuesta.ok) throw new Error("Respuesta no exitosa");
        const cuerpo = (await respuesta.json()) as { alertas?: unknown };
        if (!Array.isArray(cuerpo.alertas)) throw new Error("Respuesta inesperada");
        if (activo && revision === revisionLecturas.current && !lecturasEnCurso.current.size) {
          setAlertas(cuerpo.alertas as Alerta[]);
          setError(null);
        }
      } catch {
        if (activo) setError(MENSAJE_ERROR_CARGA);
      } finally {
        consultando = false;
        if (activo) setCargando(false);
      }
    };
    const actualizar = () => { void cargar(); };
    actualizar();
    const timer = window.setInterval(actualizar, 15_000);
    window.addEventListener("focus", actualizar);
    return () => {
      activo = false;
      controlador.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", actualizar);
    };
  }, []);

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
      guardarIdPendiente(null);
      const alerta = alertas.find((candidata) => candidata.id === id);
      if (!alerta || alerta.leida || intentadas.current.has(id)) return;
      intentadas.current.add(id);
      lecturasEnCurso.current.add(id);
      revisionLecturas.current++;
      cambiarLeida(id, true);
      void (async () => {
          const guardada = await fetchWithAuth(`${URL_ALERTAS}/${id}/leida`, { method: "PATCH" }).then(
          (respuesta) => respuesta.ok,
          () => false,
        );
        lecturasEnCurso.current.delete(id);
        revisionLecturas.current++;
        if (!guardada) cambiarLeida(id, false);
      })();
    },
    [alertas, cambiarLeida],
  );

  return { alertas, pendientes, cargando, error, seleccionada, abrirDetalle, cerrarDetalle, panelMostrado };
}
