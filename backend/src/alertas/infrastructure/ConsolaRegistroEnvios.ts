import type { IntentoEnvio, RegistroEnvios } from "../domain/EnvioCorreo";

/**
 * TS-126: deja en la consola cada intento de envío y, cuando se agotan, el error final.
 * Si más adelante se quiere guardar en la base de datos, solo hay que escribir otra clase con
 * esta misma interfaz (RegistroEnvios). No se registran direcciones de correo.
 */
export class ConsolaRegistroEnvios implements RegistroEnvios {
  registrarIntento(intento: IntentoEnvio): void {
    const base = `[envío correo] notificación ${intento.notificacionId} · intento ${intento.numero} · ${intento.resultado}`;
    if (intento.resultado === "OK") {
      console.info(base);
    } else {
      console.warn(`${base} · ${intento.error ?? "sin detalle"}`);
    }
  }

  registrarAgotado(notificacionId: number, error: string): void {
    console.error(`[envío correo] notificación ${notificacionId} · FALLIDA, no se pudo enviar. Último error: ${error}`);
  }

  registrarAviso(notificacionId: number, mensaje: string): void {
    console.warn(`[envío correo] notificación ${notificacionId} · aviso: ${mensaje}`);
  }
}
