import { Decimal } from "decimal.js";
import { DigitalChannels } from "../simulation/domain/DigitalChannels";
import { ServiceChannels } from "../simulation/domain/ServiceChannels";
import { crearCoberturaNoVerificada, type CoberturaFSD } from "../fsd/CoberturaFSD";

export interface DatosResultado {
  cuentaId: string;
  capitalInicial: Decimal;
  interesGenerado: Decimal;
  saldoFinal: Decimal;
  fechaApertura: Date;
  monthlyMaintenanceFee: Decimal;
  channels: ServiceChannels;
  coberturaFSD: CoberturaFSD;
  digitalChannels: DigitalChannels;
}

/** Resultado del cálculo de rentabilidad de una cuenta. */
export class ResultadoRentabilidad {
  private readonly cuentaId: string;
  private readonly capitalInicial: Decimal;
  private readonly interesGenerado: Decimal;
  private readonly saldoFinal: Decimal;
  private readonly fechaApertura: Date;
  private readonly monthlyMaintenanceFee: Decimal;
  private readonly channels: ServiceChannels;
  private readonly digitalChannels: DigitalChannels;

  constructor(
    cuentaId: string,
    capitalInicial: Decimal,
    interesGenerado: Decimal,
    saldoFinal: Decimal,
    fechaApertura: Date,
    monthlyMaintenanceFee: Decimal,
    channels: ServiceChannels,
    readonly coberturaFSD: CoberturaFSD = crearCoberturaNoVerificada(),
    digitalChannels: DigitalChannels = new DigitalChannels(false, false),
  ) {
    this.cuentaId = cuentaId;
    this.capitalInicial = capitalInicial;
    this.interesGenerado = interesGenerado;
    this.saldoFinal = saldoFinal;
    this.fechaApertura = fechaApertura;
    this.monthlyMaintenanceFee = monthlyMaintenanceFee;
    this.channels = channels;
    this.digitalChannels = digitalChannels;
  }

  getCuentaId(): string {
    return this.cuentaId;
  }

  getInteresGenerado(): Decimal {
    return this.interesGenerado;
  }

  getSaldoFinal(): Decimal {
    return this.saldoFinal;
  }

  getFechaApertura(): Date {
    return this.fechaApertura;
  }

  /** Todos los datos juntos (lo usa el formateador). */
  getDatos(): DatosResultado {
    return {
      cuentaId: this.cuentaId,
      capitalInicial: this.capitalInicial,
      interesGenerado: this.interesGenerado,
      saldoFinal: this.saldoFinal,
      fechaApertura: this.fechaApertura,
      monthlyMaintenanceFee: this.monthlyMaintenanceFee,
      channels: this.channels,
      coberturaFSD: this.coberturaFSD,
      digitalChannels: this.digitalChannels,
    };
  }
}
