import { describe, expect, it } from "vitest";
import { AutorizadorEnvioPro } from "../../src/alertas/infrastructure/AutorizadorEnvioPro";
import type { NotificationFrequency, NotificationType } from "../../src/notifications/NotificationPreferences";

// Acceso y preferencias simulados: se prueba solo la regla, sin base de datos.

function crear(opciones: { pro?: boolean; tipos?: NotificationType[]; frecuencia?: NotificationFrequency }) {
  return new AutorizadorEnvioPro(
    { hasProAccess: () => opciones.pro ?? true },
    {
      get: () => ({
        alertTypes: opciones.tipos ?? ["CAMBIO_TASA", "CAMBIO_RIESGO"],
        frequency: opciones.frecuencia ?? "INMEDIATA",
      }),
    },
  );
}

describe("Permiso para enviar el correo justo antes de entregarlo (US40)", () => {
  it("puede recibirlo si tiene acceso Pro y sus preferencias incluyen el tipo con frecuencia inmediata", () => {
    expect(crear({}).puedeRecibir(7, "CAMBIO_TASA")).toBe(true);
    expect(crear({}).puedeRecibir(7, "CAMBIO_RIESGO")).toBe(true);
  });

  it("no puede recibirlo si ya no tiene acceso Pro (plan vencido)", () => {
    expect(crear({ pro: false }).puedeRecibir(7, "CAMBIO_TASA")).toBe(false);
  });

  it("no puede recibirlo si dejó de seguir ese tipo de alerta, pero sí los demás", () => {
    const autorizador = crear({ tipos: ["CAMBIO_RIESGO"] });

    expect(autorizador.puedeRecibir(7, "CAMBIO_TASA")).toBe(false);
    expect(autorizador.puedeRecibir(7, "CAMBIO_RIESGO")).toBe(true);
  });

  it("no puede recibirlo si ahora prefiere el resumen diario", () => {
    expect(crear({ frecuencia: "RESUMEN_DIARIO" }).puedeRecibir(7, "CAMBIO_TASA")).toBe(false);
  });
});
