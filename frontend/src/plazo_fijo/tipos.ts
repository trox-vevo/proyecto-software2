export const PLAZOS_PERMITIDOS = [180, 360, 540, 720, 900, 1080] as const;
export type PlazoDias = (typeof PLAZOS_PERMITIDOS)[number];
export type ModalidadPago = "AT_MATURITY" | "MONTHLY";

export interface ParametrosPlazoFijo {
  amount: string;
  department: string;
  paymentMode: ModalidadPago;
  termDays: PlazoDias;
}

export function esPlazoPermitido(value: number): value is PlazoDias {
  return PLAZOS_PERMITIDOS.some((plazo) => plazo === value);
}

export function esModalidadPago(value: string): value is ModalidadPago {
  return value === "AT_MATURITY" || value === "MONTHLY";
}
