import { useState } from "react";
import { fetchWithAuth, getStoredSession } from "../auth/session";
import { sessionStore } from "../pro_access/SessionStore";
import { API_URL, isIsoDate } from "./types";
import "./commerce.css";

interface CancellationResult {
  status: "CANCELLATION_SCHEDULED";
  plan: "PRO";
  planExpiresAt: string;
  planCancellationRequested: true;
  message: string;
}

function isCancellationResult(value: unknown): value is CancellationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (
    data.status === "CANCELLATION_SCHEDULED" &&
    data.plan === "PRO" &&
    isIsoDate(data.planExpiresAt) &&
    data.planCancellationRequested === true &&
    typeof data.message === "string" &&
    Boolean(data.message.trim())
  );
}

/** US41: cancelación del Plan Pro (antes vivía dentro del Checkout). */
export function CancelSubscriptionSection() {
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  async function cancelSubscription(): Promise<void> {
    if (cancelPending) return;
    setCancelPending(true);
    setCancelError(null);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/subscription/cancel`, { method: "POST" });
      if (!response.ok) {
        setCancelError(response.status === 401
          ? "Inicia sesión para cancelar tu suscripción."
          : response.status === 409
            ? "No tienes una suscripción Pro activa."
            : "No pudimos cancelar tu suscripción. Inténtalo nuevamente.");
        return;
      }
      const data: unknown = await response.json();
      if (!isCancellationResult(data)) {
        setCancelError("No pudimos confirmar la cancelación. Inténtalo nuevamente.");
        return;
      }
      sessionStore.scheduleCancellation(data.planExpiresAt);
      setCancelSuccess(data.message);
      setCancelConfirmationOpen(false);
    } catch {
      setCancelError("No se pudo conectar con el servicio. Inténtalo nuevamente.");
    } finally {
      setCancelPending(false);
    }
  }

  if (!sessionStore.isPro()) return null;

  return (
    <section className="checkout-suscripcion" aria-labelledby="checkout-suscripcion-title">
      <h2 id="checkout-suscripcion-title">Tu suscripción Pro</h2>
      {getStoredSession()?.planCancellationRequested ? (
        <p role="status">
          {cancelSuccess ?? "La cancelación está programada para el final de tu período Pro."} Mantendrás el acceso Pro hasta{" "}
          <strong>
            {isIsoDate(getStoredSession()?.planExpiresAt)
              ? new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(new Date(getStoredSession()!.planExpiresAt!))
              : "el final del período actual"}
          </strong>.
        </p>
      ) : (
        <>
          <p>Puedes cancelar ahora y conservarás los beneficios Pro hasta el final del período pagado.</p>
          {cancelSuccess && <p role="status">{cancelSuccess}</p>}
          {cancelError && <p role="alert">{cancelError}</p>}
          {cancelConfirmationOpen ? (
            <div className="checkout-cancelacion-confirmacion">
              <p>¿Confirmas que quieres programar la cancelación de tu suscripción Pro?</p>
              <button type="button" disabled={cancelPending} onClick={() => void cancelSubscription()}>
                {cancelPending ? "Procesando…" : "Confirmar cancelación"}
              </button>
              <button type="button" disabled={cancelPending} onClick={() => setCancelConfirmationOpen(false)}>
                Mantener mi suscripción
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => { setCancelError(null); setCancelConfirmationOpen(true); }}>
              Cancelar suscripción
            </button>
          )}
        </>
      )}
    </section>
  );
}
