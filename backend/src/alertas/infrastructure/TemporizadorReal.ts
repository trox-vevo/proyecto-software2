import type { Temporizador } from "../domain/EnvioCorreo";

/** Espera de verdad. Las pruebas usan un temporizador falso que no espera. */
export class TemporizadorReal implements Temporizador {
  esperar(ms: number): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver, ms));
  }
}
