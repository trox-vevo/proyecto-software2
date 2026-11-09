export const PLAZOS_PERMITIDOS = [180, 360, 540, 720, 900, 1080] as const;
export type PlazoDias = (typeof PLAZOS_PERMITIDOS)[number];
export type ModalidadPago = "AT_MATURITY" | "MONTHLY";

export interface ParametrosPlazoFijo {
  amount: string;
  department: string;
  paymentMode: ModalidadPago;
  termDays: PlazoDias;
}

/** Contrato de SimulationController. Los importes conservan su precisión decimal. */
export interface ResultadoPlazoFijo {
  productId: number;
  entityName: string;
  tea: string;
  totalInterest: string;
  monthlyInterest: string | null;
  minimumAmount: string | null;
  /** US27: null si el usuario no es Pro (el backend la oculta) o si la US25 aún no la llena. */
  riskRating: string | null;
}

export function esPlazoPermitido(value: number): value is PlazoDias {
  return PLAZOS_PERMITIDOS.some((plazo) => plazo === value);
}

export function esModalidadPago(value: string): value is ModalidadPago {
  return value === "AT_MATURITY" || value === "MONTHLY";
}
