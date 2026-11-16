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
  /** US08/US13: monto mínimo de apertura de la cuenta (0 si no exige mínimo). */
  readonly montoMinimo: Decimal;

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
    readonly entityId: number | null = null,
    readonly entityName: string | null = null,
    /** US08/US13: departamento donde se ofrece la cuenta; null si no se conoce. */
    readonly departamento: string | null = null,
    montoMinimo: Decimal.Value = 0,
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
    this.montoMinimo = new Decimal(montoMinimo);
  }
}
