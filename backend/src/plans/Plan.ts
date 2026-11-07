export type PlanId = "BASICO" | "PRO";

export interface Plan {
  id: PlanId;
  name: string;
  price: null;
  features: Record<string, boolean>;
}

// Beneficios respaldados por el backlog y los simuladores existentes.
// Los precios requieren una definición comercial del equipo.
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
    price: null,
    features: { simulations: true, favorites: false, riskReport: false, solvencyPdf: false },
  },
  {
    id: "PRO",
    name: "Pro",
    price: null,
    features: { simulations: true, favorites: true, riskReport: true, solvencyPdf: true },
  },
];
