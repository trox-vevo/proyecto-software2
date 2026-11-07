import nodemailer from "nodemailer";
import type { RecoveryEmailService } from "../application/PasswordRecoveryService";

export class SmtpRecoveryEmailService implements RecoveryEmailService {
  async sendRecoveryLink(destination: string, link: string): Promise<boolean> {
    if (process.env.RECOVERY_EMAIL_MODE === "console") {
      if (process.env.NODE_ENV === "production") {
        throw new Error("RECOVERY_EMAIL_MODE=console no está permitido en producción");
      }
      console.info(`[recuperación local] Destinatario: ${destination}\nEnlace: ${link}`);
      return true;
    }

    const host = process.env.SMTP_HOST?.trim();
    const portText = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.SMTP_FROM?.trim();
    const port = Number(portText);

    if (!host || !portText || !Number.isInteger(port) || port < 1 || port > 65535 ||
      !user || !password || !from) {
      throw new Error("Configura SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y SMTP_FROM");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass: password },
    });
    const result = await transporter.sendMail({
      from,
      to: destination,
      subject: "Recuperación de contraseña",
      text: [
        "Recibimos una solicitud para recuperar tu contraseña.",
        `Usa este enlace dentro de la próxima hora: ${link}`,
        "Si no solicitaste este cambio, puedes ignorar este correo.",
      ].join("\n\n"),
    });

    return result.accepted.some((address) => String(address).toLowerCase() === destination.toLowerCase());
  }
}
