import { Decimal } from "decimal.js";
import { DigitalChannels } from "../simulation/domain/DigitalChannels";
import { ServiceChannels } from "../simulation/domain/ServiceChannels";
import { validarCoberturaFSD, type CoberturaFSD } from "../fsd/CoberturaFSD";

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
  readonly coberturaFSD: CoberturaFSD;
  /** US19: banca digital y app móvil de la entidad. */
  readonly digitalChannels: DigitalChannels;

  constructor(
    id: string,
    titular: string,
    saldo: Decimal.Value,
    tasaAnual: Decimal.Value,
    fechaApertura: Date,
    monthlyMaintenanceFee: Decimal.Value,
    channels: ServiceChannels,
    coberturaFSD?: unknown,
    digitalChannels: DigitalChannels = new DigitalChannels(false, false),
  ) {
    this.id = id;
    this.titular = titular;
    this.saldo = new Decimal(saldo);
    this.tasaAnual = new Decimal(tasaAnual);
    this.fechaApertura = fechaApertura;
    this.monthlyMaintenanceFee = new Decimal(monthlyMaintenanceFee);
    this.channels = channels;
    this.coberturaFSD = validarCoberturaFSD(coberturaFSD);
    this.digitalChannels = digitalChannels;
  }
}
