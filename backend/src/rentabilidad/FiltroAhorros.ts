import { Decimal } from "decimal.js";
import type { CuentaAhorros } from "./CuentaAhorros";

export interface CriteriosFiltro {
  saldoMinimo?: Decimal.Value;
  saldoMaximo?: Decimal.Value;
  /** Fecha de apertura mínima (inclusive). */
  desde?: Date;
  /** Fecha de apertura máxima (inclusive). */
  hasta?: Date;
  /** US08/US13: solo cuentas ofrecidas en este departamento. */
  departamento?: string;
  /** US08/US13: monto del usuario; excluye cuentas cuyo monto mínimo de apertura sea mayor. */
  montoDisponible?: Decimal.Value;
}

/** Decide qué cuentas entran al cálculo. Un criterio sin definir no filtra nada. */
export class FiltroAhorros {
  private readonly saldoMinimo?: Decimal;
  private readonly saldoMaximo?: Decimal;
  private readonly desde?: Date;
  private readonly hasta?: Date;
  private readonly departamento?: string;
  private readonly montoDisponible?: Decimal;

  constructor(criterios: CriteriosFiltro = {}) {
    if (criterios.saldoMinimo !== undefined) {
      this.saldoMinimo = new Decimal(criterios.saldoMinimo);
    }
    if (criterios.saldoMaximo !== undefined) {
      this.saldoMaximo = new Decimal(criterios.saldoMaximo);
    }
    this.desde = criterios.desde;
    this.hasta = criterios.hasta;
    this.departamento = criterios.departamento;
    if (criterios.montoDisponible !== undefined) {
      this.montoDisponible = new Decimal(criterios.montoDisponible);
    }
  }

  aplicar(cuentas: CuentaAhorros[]): CuentaAhorros[] {
    return cuentas.filter((cuenta) => {
      if (this.saldoMinimo !== undefined && cuenta.saldo.lt(this.saldoMinimo)) return false;
      if (this.saldoMaximo !== undefined && cuenta.saldo.gt(this.saldoMaximo)) return false;
      if (this.desde !== undefined && cuenta.fechaApertura < this.desde) return false;
      if (this.hasta !== undefined && cuenta.fechaApertura > this.hasta) return false;
      if (this.departamento !== undefined && cuenta.departamento !== this.departamento) return false;
      if (this.montoDisponible !== undefined && cuenta.montoMinimo.gt(this.montoDisponible)) return false;
      return true;
    });
  }
}
