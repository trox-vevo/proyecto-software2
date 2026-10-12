import { Decimal } from "decimal.js";
import type { CuentaAhorros } from "./CuentaAhorros";

export interface CriteriosFiltro {
  saldoMinimo?: Decimal.Value;
  saldoMaximo?: Decimal.Value;
  /** Fecha de apertura mínima (inclusive). */
  desde?: Date;
  /** Fecha de apertura máxima (inclusive). */
  hasta?: Date;
}

/** Decide qué cuentas entran al cálculo. Un criterio sin definir no filtra nada. */
export class FiltroAhorros {
  private readonly saldoMinimo?: Decimal;
  private readonly saldoMaximo?: Decimal;
  private readonly desde?: Date;
  private readonly hasta?: Date;

  constructor(criterios: CriteriosFiltro = {}) {
    if (criterios.saldoMinimo !== undefined) {
      this.saldoMinimo = new Decimal(criterios.saldoMinimo);
    }
    if (criterios.saldoMaximo !== undefined) {
      this.saldoMaximo = new Decimal(criterios.saldoMaximo);
    }
    this.desde = criterios.desde;
    this.hasta = criterios.hasta;
  }

  aplicar(cuentas: CuentaAhorros[]): CuentaAhorros[] {
    return cuentas.filter((cuenta) => {
      if (this.saldoMinimo !== undefined && cuenta.saldo.lt(this.saldoMinimo)) return false;
      if (this.saldoMaximo !== undefined && cuenta.saldo.gt(this.saldoMaximo)) return false;
      if (this.desde !== undefined && cuenta.fechaApertura < this.desde) return false;
      if (this.hasta !== undefined && cuenta.fechaApertura > this.hasta) return false;
      return true;
    });
  }
}
