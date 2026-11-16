import type { Decimal } from "decimal.js";
import type { AlgoritmoRentabilidad } from "./AlgoritmoRentabilidad";
import type { CriterioOrden } from "./CriterioOrden";
import type { CuentaAhorros } from "./CuentaAhorros";
import type { FiltroAhorros } from "./FiltroAhorros";
import type { FormateadorResultados } from "./FormateadorResultados";
import type { ResultadoFormateado } from "./ResultadoFormateado";
import { ResultadoRentabilidad } from "./ResultadoRentabilidad";

/** Coordina todo: filtra, calcula, ordena y formatea (diagrama de secuencia 1). */
export class MotorCalculo {
  private algoritmo: AlgoritmoRentabilidad;
  private readonly filtro: FiltroAhorros;
  private readonly formateador: FormateadorResultados;

  constructor(
    algoritmo: AlgoritmoRentabilidad,
    filtro: FiltroAhorros,
    formateador: FormateadorResultados,
  ) {
    this.algoritmo = algoritmo;
    this.filtro = filtro;
    this.formateador = formateador;
  }

  setAlgoritmo(algoritmo: AlgoritmoRentabilidad): void {
    this.algoritmo = algoritmo;
  }

  /** US09: con `montoInvertido`, el interés se calcula sobre ese monto y no sobre el saldo de cada cuenta. */
  calcular(cuentas: CuentaAhorros[], dias: number, criterio: CriterioOrden, montoInvertido?: Decimal): ResultadoFormateado[] {
    if (!Number.isInteger(dias) || dias <= 0) {
      throw new RangeError("dias debe ser un entero positivo");
    }

    const cuentasFiltradas = this.filtro.aplicar(cuentas);

    const resultados: ResultadoRentabilidad[] = [];
    for (const filtrada of cuentasFiltradas) {
      const cuenta = montoInvertido === undefined ? filtrada : filtrada.conCapital(montoInvertido);
      const interesGenerado = this.algoritmo.calcular(cuenta, dias);
      resultados.push(
        new ResultadoRentabilidad(
          cuenta.id,
          cuenta.saldo,
          interesGenerado,
          cuenta.saldo.plus(interesGenerado),
          cuenta.fechaApertura,
          cuenta.monthlyMaintenanceFee,
          cuenta.channels,
          cuenta.coberturaFSD,
          cuenta.digitalChannels,
          cuenta.producto?.entidad ?? cuenta.titular,
          cuenta.tasaAnual,
          cuenta.producto?.montoMinimo ?? null,
        ),
      );
    }

    const ordenados = this.formateador.ordenar(resultados, criterio);
    return this.formateador.formatear(ordenados);
  }
}
