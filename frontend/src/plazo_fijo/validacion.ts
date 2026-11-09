import type { ParametrosPlazoFijo } from "./tipos";

// Monto mínimo para abrir un plazo fijo (US07). Si cambia, solo se cambia aquí.
export const MONTO_MINIMO_APERTURA = 500;

// Mensaje que ve el usuario cuando el monto no llega al mínimo.
export const MENSAJE_MONTO_MINIMO =
  `El monto mínimo requerido para apertura una cuenta es de S/ ${MONTO_MINIMO_APERTURA.toFixed(2)}`;

// Solo números positivos, con hasta 2 decimales (igual que pide el backend).
const FORMATO_MONTO = /^\d+(\.\d{1,2})?$/;

// Revisa el monto antes de simular. Si devuelve una lista vacía, todo está bien.
export function validarParametros(parametros: ParametrosPlazoFijo): string[] {
  const monto = parametros.amount.trim();
  if (!FORMATO_MONTO.test(monto) || Number(monto) < MONTO_MINIMO_APERTURA) {
    return [MENSAJE_MONTO_MINIMO];
  }
  return [];
}
