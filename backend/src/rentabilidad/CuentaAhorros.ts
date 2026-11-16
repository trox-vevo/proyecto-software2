import { Decimal } from "decimal.js";
import { DigitalChannels } from "../simulation/domain/DigitalChannels";
import { ServiceChannels } from "../simulation/domain/ServiceChannels";
import { validarCoberturaFSD, type CoberturaFSD } from "../fsd/CoberturaFSD";

/** US09/US11: datos del producto de ahorro de la entidad. null en cuentas sin producto. */
export interface DatosProducto {
  entidad: string;
  departamento: string;
  montoMinimo: Decimal;
}

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
  /** US09/US11: producto de la entidad (departamento y monto mínimo). */
  readonly producto: DatosProducto | null;

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
    producto: DatosProducto | null = null,
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
    this.producto = producto;
  }

  /** US09: la misma cuenta con otro capital (el monto que ingresa el usuario). No modifica la original. */
  conCapital(monto: Decimal): CuentaAhorros {
    return new CuentaAhorros(
      this.id,
      this.titular,
      monto,
      this.tasaAnual,
      this.fechaApertura,
      this.monthlyMaintenanceFee,
      this.channels,
      this.coberturaFSD,
      this.digitalChannels,
      this.producto,
    );
  }
}
