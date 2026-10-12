import { Decimal } from "decimal.js";
import type { AlgoritmoRentabilidad } from "./AlgoritmoRentabilidad";
import type { CuentaAhorros } from "./CuentaAhorros";

const DIAS_POR_ANIO = 365;

/** Interés compuesto: el interés generado también genera interés. */
export class RentabilidadCompuesta implements AlgoritmoRentabilidad {
  calcular(cuenta: CuentaAhorros, dias: number): Decimal {
    // interés = capital × ((1 + tasa anual) ^ (días / 365) − 1)
    const años = new Decimal(dias).div(DIAS_POR_ANIO);
    const factor = cuenta.tasaAnual.plus(1).pow(años);
    return cuenta.saldo.mul(factor.minus(1)).toDecimalPlaces(2);
  }
}
