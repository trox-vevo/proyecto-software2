import type { Decimal } from "decimal.js";
import type { CuentaAhorros } from "./CuentaAhorros";

/** Interfaz: cualquier algoritmo de rentabilidad debe poder calcular el interés. */
export interface AlgoritmoRentabilidad {
  /** Devuelve el interés generado por la cuenta en `dias` días. */
  calcular(cuenta: CuentaAhorros, dias: number): Decimal;
}
