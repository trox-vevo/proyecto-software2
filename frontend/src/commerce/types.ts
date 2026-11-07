export interface Plan {
  id: "BASICO" | "PRO";
  name: string;
  price: null;
  features: Record<string, boolean>;
}

export interface PlanCatalog {
  plans: Plan[];
  features: { id: string; label: string }[];
}

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
