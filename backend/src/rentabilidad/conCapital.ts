import type { Decimal } from "decimal.js";
import { CuentaAhorros } from "./CuentaAhorros";

/**
 * US08/US09: copia de la cuenta cuyo capital es el monto que ingresó el usuario.
 * No modifica la cuenta original (CuentaAhorros es solo datos, de solo lectura).
 */
export function conCapital(cuenta: CuentaAhorros, monto: Decimal.Value): CuentaAhorros {
  return new CuentaAhorros(
    cuenta.id,
    cuenta.titular,
    monto,
    cuenta.tasaAnual,
    cuenta.fechaApertura,
    cuenta.monthlyMaintenanceFee,
    cuenta.channels,
    cuenta.coberturaFSD,
    cuenta.digitalChannels,
    cuenta.entityId,
    cuenta.entityName,
    cuenta.departamento,
    cuenta.montoMinimo,
  );
}
