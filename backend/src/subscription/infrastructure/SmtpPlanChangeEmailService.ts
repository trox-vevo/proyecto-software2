import nodemailer from "nodemailer";
import { PLAN_FEATURES, PLANS } from "../../plans/Plan";
import type { PlanChangeEmailService } from "../application/PlanChangeEmailService";
import type { PlanChangeReason } from "../domain/SubscriptionMaintenanceRepository";

export class SmtpPlanChangeEmailService implements PlanChangeEmailService {
  async sendPlanDowngradeNotification(
    email: string,
    planExpiresAt: string,
    reason: PlanChangeReason,
    changedAt: string,
  ): Promise<boolean> {
    if (process.env.RECOVERY_EMAIL_MODE === "console") {
      if (process.env.NODE_ENV === "production") {
        throw new Error("RECOVERY_EMAIL_MODE=console no está permitido en producción");
      }
      console.info(`[cambio de plan local] Destinatario: ${email}\nMotivo: ${reason}\nCambio: ${changedAt}`);
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

    const changeDate = Date.parse(reason === "PERIOD_EXPIRED" ? planExpiresAt : changedAt);
    if (!Number.isFinite(changeDate)) throw new RangeError("La fecha del cambio de plan no es válida.");
    const basicPlan = PLANS.find((plan) => plan.id === "BASICO");
    if (!basicPlan) throw new Error("No se encontró la configuración del plan Básico.");
    const basicBenefits = PLAN_FEATURES
      .filter((feature) => basicPlan.features[feature.id])
      .map((feature) => `- ${feature.label}`);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass: password },
    });
    const result = await transporter.sendMail({
      from,
      to: email,
      subject: reason === "PERIOD_EXPIRED"
        ? "Tu período del Plan Pro ha finalizado"
        : "Tu cuenta pasó al Plan Básico por un pago rechazado",
      text: [
        reason === "PERIOD_EXPIRED"
          ? `Tu período del Plan Pro finalizó el ${new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: "UTC" }).format(new Date(changeDate))}.`
          : `El ${new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: "UTC" }).format(new Date(changeDate))} no se pudo confirmar el pago de renovación y tu cuenta pasó al Plan Básico.`,
        "Tu plan actual es Básico. Estos son los beneficios que conservas:",
        ...basicBenefits,
      ].join("\n\n"),
    });

    return result.accepted.some((address) => String(address).toLowerCase() === email.toLowerCase());
  }
}
