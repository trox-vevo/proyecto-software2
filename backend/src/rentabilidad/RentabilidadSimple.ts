import type { Decimal } from "decimal.js";
import type { AlgoritmoRentabilidad } from "./AlgoritmoRentabilidad";
import type { CuentaAhorros } from "./CuentaAhorros";

const DIAS_POR_ANIO = 365;

/** Interés simple: el interés se calcula siempre sobre el capital inicial. */
export class RentabilidadSimple implements AlgoritmoRentabilidad {
  calcular(cuenta: CuentaAhorros, dias: number): Decimal {
    // interés = capital × tasa anual × (días / 365)
    return cuenta.saldo
      .mul(cuenta.tasaAnual)
      .mul(dias)
      .div(DIAS_POR_ANIO)
      .toDecimalPlaces(2);
  }
}
