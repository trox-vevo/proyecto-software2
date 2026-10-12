import type { Decimal } from "decimal.js";
import { CriterioOrden } from "./CriterioOrden";
import type { ResultadoRentabilidad } from "./ResultadoRentabilidad";
import type { ResultadoFormateado } from "./ResultadoFormateado";

/** 1250.5 -> "1,250.50" (separador de miles y dos decimales). */
function monto(valor: Decimal): string {
  const [entero, decimales] = valor.toFixed(2).split(".");
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + decimales;
}

/** Date -> "15/03/2024" (en UTC, para que no cambie con la zona horaria). */
function fecha(valor: Date): string {
  const dd = String(valor.getUTCDate()).padStart(2, "0");
  const mm = String(valor.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${valor.getUTCFullYear()}`;
}

export class FormateadorResultados {
  /**
   * Ordena de mayor a menor (en FECHA, la más reciente primero).
   * Trabaja sobre los valores reales; por eso va ANTES de formatear.
   * Devuelve una lista nueva, no modifica la original.
   */
  ordenar(resultados: ResultadoRentabilidad[], criterio: CriterioOrden): ResultadoRentabilidad[] {
    const copia = [...resultados];
    switch (criterio) {
      case CriterioOrden.RENTABILIDAD:
        return copia.sort((a, b) => b.getInteresGenerado().comparedTo(a.getInteresGenerado()));
      case CriterioOrden.SALDO:
        return copia.sort((a, b) => b.getSaldoFinal().comparedTo(a.getSaldoFinal()));
      case CriterioOrden.FECHA:
        return copia.sort((a, b) => b.getFechaApertura().getTime() - a.getFechaApertura().getTime());
    }
  }

  /** Convierte cada resultado a un texto legible. */
  formatear(resultados: ResultadoRentabilidad[]): ResultadoFormateado[] {
    return resultados.map((resultado) => {
      const d = resultado.getDatos();
      return {
        cuentaId: d.cuentaId,
        capitalInicial: monto(d.capitalInicial),
        interesGenerado: monto(d.interesGenerado),
        saldoFinal: monto(d.saldoFinal),
        fechaApertura: fecha(d.fechaApertura),
      };
    });
  }
}
