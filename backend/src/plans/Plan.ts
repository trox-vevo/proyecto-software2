export type PlanId = "BASICO" | "PRO";

/** US31 (decisión del PO): precio mensual del Plan Pro. Única fuente de verdad; texto con 2 decimales. */
export const PRO_MONTHLY_PRICE = "9.90";
export const PLAN_CURRENCY = "PEN";

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  billingPeriod: "MONTHLY";
  features: Record<string, boolean>;
}

// Beneficios respaldados por el backlog y los simuladores existentes.
export const PLAN_FEATURES = [
  { id: "simulations", label: "Simulaciones de ahorro y plazo fijo" },
  { id: "favorites", label: "Guardar simulaciones favoritas" },
  { id: "riskReport", label: "Informe de riesgo avanzado" },
  { id: "solvencyPdf", label: "Reporte de solvencia en PDF" },
];

export const PLANS: Plan[] = [
  {
    id: "BASICO",
    name: "Básico",
    price: "0.00",
    billingPeriod: "MONTHLY",
    features: { simulations: true, favorites: false, riskReport: false, solvencyPdf: false },
  },
  {
    id: "PRO",
    name: "Pro",
    price: PRO_MONTHLY_PRICE,
    billingPeriod: "MONTHLY",
    features: { simulations: true, favorites: true, riskReport: true, solvencyPdf: true },
  },
];
