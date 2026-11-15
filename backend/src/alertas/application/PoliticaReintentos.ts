// TS-125: cuántos intentos se hacen y cuánto se espera entre ellos (espera exponencial).

export class PoliticaReintentos {
  /**
   * @param maxIntentos intentos en total, contando el primero (por defecto 3).
   * @param retrasoBaseMs espera después del primer fallo; se duplica en cada intento siguiente.
   */
  constructor(
    readonly maxIntentos = 3,
    readonly retrasoBaseMs = 1000,
  ) {
    if (!Number.isInteger(maxIntentos) || maxIntentos < 1) {
      throw new RangeError("maxIntentos debe ser un entero de al menos 1.");
    }
    if (!Number.isFinite(retrasoBaseMs) || retrasoBaseMs < 0) {
      throw new RangeError("retrasoBaseMs debe ser un número mayor o igual a 0.");
    }
  }

  /** Espera antes del siguiente intento, cuando acaba de fallar el intento número `intento`: base, 2 × base, 4 × base… */
  retrasoTras(intento: number): number {
    return this.retrasoBaseMs * 2 ** (intento - 1);
  }

  /** Suma de todas las esperas posibles entre intentos; la reserva de la cola debe durar más que esto. */
  esperaTotalMs(): number {
    let total = 0;
    for (let intento = 1; intento < this.maxIntentos; intento++) total += this.retrasoTras(intento);
    return total;
  }
}
