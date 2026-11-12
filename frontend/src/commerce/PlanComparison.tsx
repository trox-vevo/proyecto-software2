import { useEffect, useState } from "react";
import { API_URL } from "./types";
import type { PlanCatalog } from "./types";
import "./commerce.css";

export function PlanComparison({ onCheckout }: { onCheckout: () => void }) {
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/plans`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo consultar los planes.");
        const data = await response.json() as PlanCatalog;
        if (!Array.isArray(data.plans) || !Array.isArray(data.features)) throw new Error("El catálogo de planes no está disponible.");
        if (!controller.signal.aborted) setCatalog(data);
      })
      .catch(() => { if (!controller.signal.aborted) setError("No se pudo consultar los planes. Inténtalo nuevamente."); });
    return () => controller.abort();
  }, [attempt]);

  return <main className="pagina comercio">
    <h1>Compara los planes</h1>
    <p>Elige las funciones que necesitas para tus simulaciones.</p>
    {error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setCatalog(null); setAttempt(attempt + 1); }}>Reintentar</button></div>
      : !catalog ? <p role="status">Cargando planes…</p>
        : catalog.plans.length === 0 ? <p role="status">No hay planes disponibles por el momento.</p>
          : <div className="tabla-contenedor">
            <table className="tabla-ahorros planes-tabla">
              <caption>Beneficios de los planes Básico y Pro</caption>
              <thead><tr><th scope="col">Beneficio</th>{catalog.plans.map((plan) => <th scope="col" key={plan.id}>{plan.name}</th>)}</tr></thead>
              <tbody>
                <tr><th scope="row">Precio</th>{catalog.plans.map((plan) => <td key={plan.id}>Precio pendiente de definición</td>)}</tr>
                {catalog.features.map((feature) => <tr key={feature.id}>
                  <th scope="row">{feature.label}</th>
                  {catalog.plans.map((plan) => <td key={plan.id}>{plan.features[feature.id] ? "Incluido" : "Requiere Pro"}</td>)}
                </tr>)}
              </tbody>
            </table>
            <p className="comercio-ayuda">El informe avanzado y el reporte PDF estarán disponibles al completarse su integración.</p>
            {catalog.plans.some((plan) => plan.id === "PRO") && <button type="button" onClick={onCheckout}>Continuar al checkout Pro</button>}
          </div>}
  </main>;
}
