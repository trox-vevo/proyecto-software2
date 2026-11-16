export interface Plan {
  id: "BASICO" | "PRO";
  name: string;
  /** Texto con 2 decimales ("0.00", "9.90"); lo define el backend. */
  price: string;
  billingPeriod: "MONTHLY";
  features: Record<string, boolean>;
}

export interface PlanCatalog {
  plans: Plan[];
  features: { id: string; label: string }[];
}

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * US31: copia de PRO_MONTHLY_PRICE de backend/src/plans/Plan.ts, solo para textos fijos (paywall, Mi suscripción).
 * La comparación de planes y el checkout leen el precio de la API. app/rutas.test.tsx (caso 15) verifica que coincidan.
 */
export const PRO_MONTHLY_PRICE = "9.90";

export function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
