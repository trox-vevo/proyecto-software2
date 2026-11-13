import { useEffect, useState } from "react";
import {
  AUTH_SESSION_CHANGED_EVENT,
  fetchWithAuth,
  getStoredSession,
} from "../auth/session";
import { sessionStore } from "../pro_access/SessionStore";
import "./commerce.css";

type PlanChangeReason = "PERIOD_EXPIRED" | "RENEWAL_PAYMENT_FAILED";

interface PlanChangeHistoryEntry {
  id: number;
  fromPlan: "PRO";
  toPlan: "BASICO";
  reason: PlanChangeReason;
  changedAt: string;
  planExpiresAt: string;
}

interface SubscriptionStatus {
  plan: "BASICO" | "PRO";
  planExpiresAt: string | null;
  planCancellationRequested: boolean;
  history: PlanChangeHistoryEntry[];
}

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  if (typeof value !== "object" || value === null) return false;
  const status = value as Record<string, unknown>;
  return (
    (status.plan === "BASICO" || status.plan === "PRO") &&
    (status.planExpiresAt === null || typeof status.planExpiresAt === "string") &&
    typeof status.planCancellationRequested === "boolean" &&
    Array.isArray(status.history) &&
    status.history.every((item) => {
      if (typeof item !== "object" || item === null) return false;
      const entry = item as Record<string, unknown>;
      return (
        typeof entry.id === "number" &&
        entry.fromPlan === "PRO" &&
        entry.toPlan === "BASICO" &&
        (entry.reason === "PERIOD_EXPIRED" || entry.reason === "RENEWAL_PAYMENT_FAILED") &&
        typeof entry.changedAt === "string" &&
          Number.isFinite(Date.parse(entry.changedAt)) &&
          typeof entry.planExpiresAt === "string"
      );
    })
  );
}

export function SubscriptionStatusBanner() {
  const [session, setSession] = useState(getStoredSession);
  const [subscriptionData, setSubscriptionData] = useState<{
    userId: number;
    status: SubscriptionStatus;
  } | null>(null);
  const [historyErrorUserId, setHistoryErrorUserId] = useState<number | null>(null);

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
    const userId = session?.userId;
    const tokenJwt = session?.tokenJwt;
    if (userId === undefined || tokenJwt === undefined) return;

    const controller = new AbortController();
    void fetchWithAuth("/api/subscription/history", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo consultar el historial.");
        const body: unknown = await response.json();
        if (!isSubscriptionStatus(body)) throw new Error("La respuesta del historial no es válida.");
        return body;
      })
      .then((subscriptionStatus) => {
        if (controller.signal.aborted) return;
        setHistoryErrorUserId((previous) => previous === userId ? null : previous);
        const currentSession = getStoredSession();
        if (
          currentSession?.userId === userId &&
          currentSession.tokenJwt === tokenJwt &&
          (currentSession.plan !== subscriptionStatus.plan ||
            currentSession.planExpiresAt !== subscriptionStatus.planExpiresAt ||
            (currentSession.planCancellationRequested ?? false) !== subscriptionStatus.planCancellationRequested)
        ) {
          sessionStore.setPlan(subscriptionStatus.plan, {
            planExpiresAt: subscriptionStatus.planExpiresAt,
            planCancellationRequested: subscriptionStatus.planCancellationRequested,
          });
        }
        setSubscriptionData({ userId, status: subscriptionStatus });
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistoryErrorUserId(userId);
      });

    return () => controller.abort();
  }, [session?.userId, session?.tokenJwt]);

  useEffect(() => {
    const planExpiresAt = session?.planExpiresAt;
    if (!session?.planCancellationRequested || !planExpiresAt) return;
    const expiration = Date.parse(planExpiresAt);
    let timer: number;
    const refresh = () => {
      const remaining = expiration - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        sessionStore.setPlan("BASICO");
        return;
      }
      timer = window.setTimeout(refresh, Math.min(remaining + 1, 86_400_000));
    };
    timer = window.setTimeout(refresh, Math.max(0, Math.min(expiration - Date.now() + 1, 86_400_000)));
    return () => window.clearTimeout(timer);
  }, [session]);

  const cancellationScheduled = session?.plan === "PRO" &&
    session.planCancellationRequested &&
    Boolean(session.planExpiresAt);
  const expiration = cancellationScheduled ? Date.parse(session.planExpiresAt!) : NaN;
  const status = subscriptionData && subscriptionData.userId === session?.userId
    ? subscriptionData.status
    : null;
  const history = status?.history ?? [];
  const historyError = historyErrorUserId === session?.userId;
  if (!session || (!cancellationScheduled && history.length === 0 && !historyError)) return null;

  return (
    <aside className="suscripcion-banner" role="status" aria-label="Estado de suscripción">
      {cancellationScheduled && Number.isFinite(expiration) && (
        <p>
          <strong>Cancelación programada.</strong>{" "}
          Tu Plan Pro seguirá activo hasta{" "}
          <time dateTime={session.planExpiresAt!}>
            {new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(new Date(expiration))}
          </time>
          . Después conservarás las funciones del plan Básico.
        </p>
      )}
      {history.length > 0 && (
        <section aria-label="Historial de suscripción">
          <p>
            <strong>Último cambio:</strong> Pro → Básico por{" "}
            {history[0].reason === "PERIOD_EXPIRED"
              ? "finalización del período"
              : "fallo en el pago de renovación"}
            , el{" "}
            <time dateTime={history[0].changedAt}>
              {new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(new Date(history[0].changedAt))}
            </time>
            .
          </p>
          <strong>Tu historial de cambios de plan</strong>
          <details>
            <summary>Consultar historial ({history.length})</summary>
            <ol>
              {history.map((entry) => (
                <li key={entry.id}>
                  Plan Pro → Básico:{" "}
                  {entry.reason === "PERIOD_EXPIRED"
                    ? "período finalizado"
                    : "pago de renovación rechazado"}{" "}
                  el{" "}
                  <time dateTime={entry.changedAt}>
                    {new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(new Date(entry.changedAt))}
                  </time>
                  .
                </li>
              ))}
            </ol>
          </details>
        </section>
      )}
      {historyError && <p role="alert">No se pudo consultar el historial de tu suscripción.</p>}
    </aside>
  );
}
