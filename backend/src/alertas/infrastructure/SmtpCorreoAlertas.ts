import nodemailer from "nodemailer";
import type { ContenidoCorreo, ProveedorCorreo } from "../domain/EnvioCorreo";

/**
 * Envía los correos de alerta por SMTP. Usa las mismas variables que la recuperación de contraseña
 * (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, SMTP_SECURE).
 * Con RECOVERY_EMAIL_MODE=console no envía nada: escribe el correo en la consola (solo para desarrollo).
 */
export class SmtpCorreoAlertas implements ProveedorCorreo {
  private transporte: ReturnType<typeof nodemailer.createTransport> | null = null;
  private remitente = "";

  async enviar(para: string, contenido: ContenidoCorreo): Promise<boolean> {
    if ((process.env.ALERT_EMAIL_MODE ?? process.env.RECOVERY_EMAIL_MODE) === "console") {
      if (process.env.NODE_ENV === "production") {
        throw new Error("RECOVERY_EMAIL_MODE=console no está permitido en producción");
      }
      console.info(`[alertas local] Destinatario: ${para}\nAsunto: ${contenido.asunto}\n\n${contenido.texto}`);
      return true;
    }

    const transporte = this.obtenerTransporte();
    const resultado = await transporte.sendMail({
      from: this.remitente,
      to: para,
      subject: contenido.asunto,
      text: contenido.texto,
      html: contenido.html,
    });

    return resultado.accepted.some((direccion: unknown) => String(direccion).toLowerCase() === para.toLowerCase());
  }

  /** Se crea una sola vez y se reutiliza en los reintentos. */
  private obtenerTransporte() {
    if (this.transporte) return this.transporte;

    const host = process.env.SMTP_HOST?.trim();
    const portTexto = process.env.SMTP_PORT?.trim();
    const usuario = process.env.SMTP_USER?.trim();
    const clave = process.env.SMTP_PASSWORD;
    const remitente = process.env.SMTP_FROM?.trim();
    const puerto = Number(portTexto);

    if (!host || !portTexto || !Number.isInteger(puerto) || puerto < 1 || puerto > 65535 || !usuario || !clave || !remitente) {
      throw new Error("Configura SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y SMTP_FROM");
    }

    this.remitente = remitente;
    this.transporte = nodemailer.createTransport({
      host,
      port: puerto,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: usuario, pass: clave },
    });
    return this.transporte;
  }
}
