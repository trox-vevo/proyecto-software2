import { Decimal } from "decimal.js";
import { ServiceChannels } from "../simulation/domain/ServiceChannels";

/** Cuenta de ahorros del cliente. Solo guarda datos, sin lógica. */
export class CuentaAhorros {
  readonly id: string;
  readonly titular: string;
  readonly saldo: Decimal;
  /** Tasa anual como fracción: 0.05 equivale a 5 %. */
  readonly tasaAnual: Decimal;
  readonly fechaApertura: Date;
  /** US17: comisión de mantenimiento mensual de la entidad. */
  readonly monthlyMaintenanceFee: Decimal;
  /** US18: canales de atención física de la entidad. */
  readonly channels: ServiceChannels;

  constructor(
    id: string,
    titular: string,
    saldo: Decimal.Value,
    tasaAnual: Decimal.Value,
    fechaApertura: Date,
    monthlyMaintenanceFee: Decimal.Value,
    channels: ServiceChannels,
  ) {
    this.id = id;
    this.titular = titular;
    this.saldo = new Decimal(saldo);
    this.tasaAnual = new Decimal(tasaAnual);
    this.fechaApertura = fechaApertura;
    this.monthlyMaintenanceFee = new Decimal(monthlyMaintenanceFee);
    this.channels = channels;
  }
}
