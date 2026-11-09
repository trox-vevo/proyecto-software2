import { useState } from "react";
import { fetchWithAuth } from "../auth/session";
import { API_URL } from "../commerce/types";
import { PaywallModal } from "./PaywallModal";
import { sessionStore } from "./SessionStore";
import "./ProAccess.css";

interface Props {
  entityId: number;
  riskRating: string | null;
  onViewPlans: () => void; // () => navigate("/planes")
  onReportLoaded?: (report: unknown) => void; // lo conecta la US26
}

// US27 (TS-84): candado para no Pro. Es solo experiencia de usuario; el backend también bloquea.
export function RiskBadge({ entityId, riskRating, onViewPlans, onReportLoaded }: Props) {
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    setError(null);
    if (!sessionStore.isPro()) {
      setPaywallOpen(true); // Escenario 2: NO se llama a la API
      return;
    }
    try {
      const response = await fetchWithAuth(`${API_URL}/api/risk-reports/${entityId}`);
      if (response.status === 403) {
        sessionStore.setPlan("BASICO"); // plan vencido o desactualizado
        setPaywallOpen(true);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      onReportLoaded?.(await response.json());
    } catch {
      setError("No pudimos cargar el informe. Intenta de nuevo.");
    }
  }

  function showLock() {
    return (
      <span className="riesgo-pro riesgo-pro--bloqueado">
        <span className="riesgo-pro-candado" aria-hidden="true">🔒</span> Exclusivo Pro
      </span>
    );
  }

  function showRating() {
    return <span className="riesgo-pro">{riskRating}</span>;
  }

  // Sin calificación (el backend la ocultó o la US25 aún no la llena) nunca queda un hueco vacío
  const locked = !sessionStore.isPro() || riskRating === null;

  return (
    <>
      <button type="button" className="riesgo-pro-boton" onClick={handleClick}>
        {locked ? showLock() : showRating()}
      </button>
      {error && <small role="alert">{error}</small>}
      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} onViewPlans={onViewPlans} />
    </>
  );
}
