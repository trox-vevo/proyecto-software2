import { Decimal } from "decimal.js";

export interface DatosResultado {
  cuentaId: string;
  capitalInicial: Decimal;
  interesGenerado: Decimal;
  saldoFinal: Decimal;
  fechaApertura: Date;
}

/** Resultado del cálculo de rentabilidad de una cuenta. */
export class ResultadoRentabilidad {
  private readonly cuentaId: string;
  private readonly capitalInicial: Decimal;
  private readonly interesGenerado: Decimal;
  private readonly saldoFinal: Decimal;
  private readonly fechaApertura: Date;

  constructor(
    cuentaId: string,
    capitalInicial: Decimal,
    interesGenerado: Decimal,
    saldoFinal: Decimal,
    fechaApertura: Date,
  ) {
    this.cuentaId = cuentaId;
    this.capitalInicial = capitalInicial;
    this.interesGenerado = interesGenerado;
    this.saldoFinal = saldoFinal;
    this.fechaApertura = fechaApertura;
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
    };
  }
}
