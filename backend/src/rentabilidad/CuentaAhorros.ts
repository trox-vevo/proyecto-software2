import { Decimal } from "decimal.js";

/** Cuenta de ahorros del cliente. Solo guarda datos, sin lógica. */
export class CuentaAhorros {
  readonly id: string;
  readonly titular: string;
  readonly saldo: Decimal;
  /** Tasa anual como fracción: 0.05 equivale a 5 %. */
  readonly tasaAnual: Decimal;
  readonly fechaApertura: Date;

  constructor(
    id: string,
    titular: string,
    saldo: Decimal.Value,
    tasaAnual: Decimal.Value,
    fechaApertura: Date,
  ) {
    this.id = id;
    this.titular = titular;
    this.saldo = new Decimal(saldo);
    this.tasaAnual = new Decimal(tasaAnual);
    this.fechaApertura = fechaApertura;
  }
}
