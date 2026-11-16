import { Decimal } from "decimal.js";
import type { CuentaAhorros } from "./CuentaAhorros";

export interface CriteriosFiltro {
  saldoMinimo?: Decimal.Value;
  saldoMaximo?: Decimal.Value;
  /** Fecha de apertura mínima (inclusive). */
  desde?: Date;
  /** Fecha de apertura máxima (inclusive). */
  hasta?: Date;
  /** US09: solo productos de este departamento (sin distinguir mayúsculas). */
  departamento?: string;
  /** US09/US13: excluye productos cuyo monto mínimo supera el monto invertido. */
  montoInvertido?: Decimal.Value;
}

/** Decide qué cuentas entran al cálculo. Un criterio sin definir no filtra nada. */
export class FiltroAhorros {
  private readonly saldoMinimo?: Decimal;
  private readonly saldoMaximo?: Decimal;
  private readonly desde?: Date;
  private readonly hasta?: Date;
  private readonly departamento?: string;
  private readonly montoInvertido?: Decimal;

  constructor(criterios: CriteriosFiltro = {}) {
    if (criterios.saldoMinimo !== undefined) {
      this.saldoMinimo = new Decimal(criterios.saldoMinimo);
    }
    if (criterios.saldoMaximo !== undefined) {
      this.saldoMaximo = new Decimal(criterios.saldoMaximo);
    }
    this.desde = criterios.desde;
    this.hasta = criterios.hasta;
    if (criterios.departamento !== undefined) {
      this.departamento = criterios.departamento.trim().toLowerCase();
    }
    if (criterios.montoInvertido !== undefined) {
      this.montoInvertido = new Decimal(criterios.montoInvertido);
    }
  }

  aplicar(cuentas: CuentaAhorros[]): CuentaAhorros[] {
    return cuentas.filter((cuenta) => {
      if (this.saldoMinimo !== undefined && cuenta.saldo.lt(this.saldoMinimo)) return false;
      if (this.saldoMaximo !== undefined && cuenta.saldo.gt(this.saldoMaximo)) return false;
      if (this.desde !== undefined && cuenta.fechaApertura < this.desde) return false;
      if (this.hasta !== undefined && cuenta.fechaApertura > this.hasta) return false;
      if (this.departamento !== undefined
        && cuenta.producto?.departamento.trim().toLowerCase() !== this.departamento) return false;
      if (this.montoInvertido !== undefined
        && (cuenta.producto === null || cuenta.producto.montoMinimo.gt(this.montoInvertido))) return false;
      return true;
    });
  }
}
