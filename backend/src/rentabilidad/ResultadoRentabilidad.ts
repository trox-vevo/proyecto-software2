import { Decimal } from "decimal.js";
import { ServiceChannels } from "../simulation/domain/ServiceChannels";

export interface DatosResultado {
  cuentaId: string;
  capitalInicial: Decimal;
  interesGenerado: Decimal;
  saldoFinal: Decimal;
  fechaApertura: Date;
  monthlyMaintenanceFee: Decimal;
  channels: ServiceChannels;
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

  constructor(
    cuentaId: string,
    capitalInicial: Decimal,
    interesGenerado: Decimal,
    saldoFinal: Decimal,
    fechaApertura: Date,
    monthlyMaintenanceFee: Decimal,
    channels: ServiceChannels,
  ) {
    this.cuentaId = cuentaId;
    this.capitalInicial = capitalInicial;
    this.interesGenerado = interesGenerado;
    this.saldoFinal = saldoFinal;
    this.fechaApertura = fechaApertura;
    this.monthlyMaintenanceFee = monthlyMaintenanceFee;
    this.channels = channels;
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
    };
  }
}
