import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  AUTH_SESSION_CHANGED_EVENT,
  fetchWithAuth,
  getStoredSession,
} from "../auth/session";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type NotificationType = "CAMBIO_TASA" | "CAMBIO_RIESGO";
type NotificationFrequency = "INMEDIATA" | "RESUMEN_DIARIO";
interface Preferences {
  alertTypes: NotificationType[];
  frequency: NotificationFrequency;
}

type LoadResult =
  | { key: string; kind: "ready" }
  | { key: string; kind: "denied"; message: string }
  | { key: string; kind: "error"; message: string };

const DEFAULT_PREFERENCES: Preferences = {
  alertTypes: ["CAMBIO_TASA", "CAMBIO_RIESGO"],
  frequency: "INMEDIATA",
};

function isPreferences(value: unknown): value is Preferences {
  if (typeof value !== "object" || value === null) return false;
  const preferences = value as Record<string, unknown>;
  return (
    Array.isArray(preferences.alertTypes) &&
    preferences.alertTypes.length > 0 &&
    preferences.alertTypes.every((type) => type === "CAMBIO_TASA" || type === "CAMBIO_RIESGO") &&
    (preferences.frequency === "INMEDIATA" || preferences.frequency === "RESUMEN_DIARIO")
  );
}

async function responseMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return `El servidor respondió con el código ${response.status}.`;
}

export function NotificationPreferences() {
  const [session, setSession] = useState(getStoredSession);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loadResult, setLoadResult] = useState<LoadResult | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorAlGuardar, setErrorAlGuardar] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  useEffect(() => {
    const refresh = () => setSession(getStoredSession());
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (session === null || session.plan === "BASICO") return () => controller.abort();

    const key = `${session.userId}:${session.tokenJwt}:${session.plan}:${session.planExpiresAt ?? ""}`;
    fetchWithAuth(`${API_URL}/api/notifications/preferences`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const message = await responseMessage(response);
          if (response.status === 403) {
            if (!controller.signal.aborted) setLoadResult({ key, kind: "denied", message });
            return null;
          }
          throw new Error(message);
        }
        const body: unknown = await response.json();
        if (!isPreferences(body)) {
          throw new Error("El servidor devolvió preferencias de notificación inválidas.");
        }
        return body;
      })
      .then((body) => {
        if (controller.signal.aborted || body === null) return;
        setPreferences(body);
        setLoadResult({ key, kind: "ready" });
        setErrorAlGuardar("");
        setConfirmacion("");
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setLoadResult({
          key,
          kind: "error",
          message: cause instanceof Error ? cause.message : "No se pudieron cargar las preferencias.",
        });
      });

    return () => controller.abort();
  }, [session]);

  const sessionKey = session === null
    ? null
    : `${session.userId}:${session.tokenJwt}:${session.plan}:${session.planExpiresAt ?? ""}`;
  const currentLoadResult = loadResult?.key === sessionKey ? loadResult : null;

  function toggleAlert(type: NotificationType, checked: boolean) {
    setPreferences((current) => ({
      ...current,
      alertTypes: checked
        ? [...current.alertTypes, type]
        : current.alertTypes.filter((value) => value !== type),
    }));
    setErrorAlGuardar("");
    setConfirmacion("");
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preferences.alertTypes.length === 0) {
      setErrorAlGuardar("Selecciona al menos un tipo de alerta.");
      return;
    }

    setGuardando(true);
    setErrorAlGuardar("");
    setConfirmacion("");
    try {
      const response = await fetchWithAuth(`${API_URL}/api/notifications/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const body: unknown = await response.json();
      if (!isPreferences(body)) {
        throw new Error("El servidor devolvió preferencias de notificación inválidas.");
      }
      setPreferences(body);
      setConfirmacion("Tus preferencias de notificación han sido actualizadas.");
    } catch (cause: unknown) {
      setErrorAlGuardar(cause instanceof Error ? cause.message : "No se pudieron guardar las preferencias.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="preferencias-notificaciones" aria-labelledby="titulo-notificaciones">
      <h3 id="titulo-notificaciones">Preferencias de notificaciones</h3>
      {session === null && (
        <p role="status">Inicia sesión con un plan Pro para personalizar tus alertas.</p>
      )}
      {session?.plan === "BASICO" && (
        <p role="status">
          Esta función está disponible solo para usuarios Pro. Actualiza tu plan para personalizar tus alertas.
        </p>
      )}
      {session?.plan === "PRO" && currentLoadResult === null && (
        <p role="status">Cargando preferencias…</p>
      )}
      {currentLoadResult?.kind === "denied" && (
        <p role="status">{currentLoadResult.message}</p>
      )}
      {currentLoadResult?.kind === "error" && (
        <p className="mensaje-perfil error" role="alert">{currentLoadResult.message}</p>
      )}
      {session?.plan === "PRO" && currentLoadResult?.kind === "ready" && (
        <form onSubmit={guardar}>
          <fieldset>
            <legend>Tipos de alerta</legend>
            <label>
              <input
                type="checkbox"
                disabled={guardando}
                checked={preferences.alertTypes.includes("CAMBIO_TASA")}
                onChange={(event) => toggleAlert("CAMBIO_TASA", event.target.checked)}
              />
              Cambios en tasas de interés
            </label>
            <label>
              <input
                type="checkbox"
                disabled={guardando}
                checked={preferences.alertTypes.includes("CAMBIO_RIESGO")}
                onChange={(event) => toggleAlert("CAMBIO_RIESGO", event.target.checked)}
              />
              Cambios en nivel de riesgo
            </label>
          </fieldset>
          <label>
            Frecuencia
            <select
              disabled={guardando}
              value={preferences.frequency}
              onChange={(event) => {
                setPreferences({
                  ...preferences,
                  frequency: event.target.value === "RESUMEN_DIARIO"
                    ? "RESUMEN_DIARIO"
                    : "INMEDIATA",
                });
                setErrorAlGuardar("");
                setConfirmacion("");
              }}
            >
              <option value="INMEDIATA">Inmediata</option>
              <option value="RESUMEN_DIARIO">Resumen diario</option>
            </select>
          </label>
          <button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar preferencias"}
          </button>
          {errorAlGuardar && <p className="mensaje-perfil error" role="alert">{errorAlGuardar}</p>}
          {confirmacion && <p className="mensaje-perfil" role="status">{confirmacion}</p>}
        </form>
      )}
    </section>
  );
}
