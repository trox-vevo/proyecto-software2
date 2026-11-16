import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContenidoCorreo } from "../../src/alertas/domain/EnvioCorreo";
import { SmtpCorreoAlertas } from "../../src/alertas/infrastructure/SmtpCorreoAlertas";

// Ningún correo sale de verdad: en modo consola no se abre ninguna conexión SMTP.

const CORREO: ContenidoCorreo = { asunto: "Alerta crítica: cambio de tasa en Entidad A", html: "<p>x</p>", texto: "Tasa nueva: 6.00%" };

const VARIABLES = [
  "ALERT_EMAIL_MODE",
  "RECOVERY_EMAIL_MODE",
  "NODE_ENV",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
] as const;
const guardadas = new Map<string, string | undefined>();

beforeEach(() => {
  for (const nombre of VARIABLES) {
    guardadas.set(nombre, process.env[nombre]);
    Reflect.deleteProperty(process.env, nombre);
  }
});

afterEach(() => {
  for (const nombre of VARIABLES) {
    const valor = guardadas.get(nombre);
    if (valor === undefined) Reflect.deleteProperty(process.env, nombre);
    else process.env[nombre] = valor;
  }
  vi.restoreAllMocks();
});

describe("Proveedor de correo de alertas (US40): modo consola como en US14", () => {
  it("con ALERT_EMAIL_MODE=console escribe el correo en la consola y no envía nada", async () => {
    process.env.ALERT_EMAIL_MODE = "console";
    const consola = vi.spyOn(console, "info").mockImplementation(() => {});

    const aceptado = await new SmtpCorreoAlertas().enviar("ana@ejemplo.com", CORREO);

    expect(aceptado).toBe(true);
    expect(consola).toHaveBeenCalledOnce();
    expect(String(consola.mock.calls[0][0])).toContain(CORREO.asunto);
  });

  it("con RECOVERY_EMAIL_MODE=console (la variable de US14) también funciona", async () => {
    process.env.RECOVERY_EMAIL_MODE = "console";
    const consola = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(await new SmtpCorreoAlertas().enviar("ana@ejemplo.com", CORREO)).toBe(true);
    expect(consola).toHaveBeenCalledOnce();
  });

  it("el modo consola no está permitido en producción", async () => {
    process.env.ALERT_EMAIL_MODE = "console";
    process.env.NODE_ENV = "production";

    await expect(new SmtpCorreoAlertas().enviar("ana@ejemplo.com", CORREO)).rejects.toThrow(
      "no está permitido en producción",
    );
  });

  it("sin modo consola y sin SMTP configurado falla con un mensaje claro", async () => {
    await expect(new SmtpCorreoAlertas().enviar("ana@ejemplo.com", CORREO)).rejects.toThrow("Configura SMTP_HOST");
  });
    it("un ALERT_EMAIL_MODE vacío cae en RECOVERY_EMAIL_MODE", async () => {
    process.env.ALERT_EMAIL_MODE = "";
    process.env.RECOVERY_EMAIL_MODE = "console";
    const consola = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(await new SmtpCorreoAlertas().enviar("ana@ejemplo.com", CORREO)).toBe(true);
    expect(consola).toHaveBeenCalledOnce();
  });
});
