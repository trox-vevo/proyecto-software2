import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteResolvedorAlertaCorreo } from "../../src/alertas/infrastructure/SqliteResolvedorAlertaCorreo";
import type { AlertEvent, QueuedNotification } from "../../src/notifications/queue/domain/QueueContracts";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";

// Usa el catálogo real de demostración (db/schema.sql y db/seed.sql) en una base en memoria:
// la entidad 1 se llama "Entidad A".

function notificacion(event: Partial<AlertEvent>): QueuedNotification {
  return {
    id: 21,
    userId: 7,
    frequency: "INMEDIATA",
    availableAt: "2026-11-14T00:00:00.000Z",
    event: {
      eventId: "evento-1",
      entityId: 1,
      type: "CAMBIO_TASA",
      previousValue: "0.05",
      currentValue: "0.06",
      occurredAt: "2026-11-14T00:00:00.000Z",
      ...event,
    },
    idempotencyKey: "clave",
    status: "CLAIMED",
    createdAt: "2026-11-14T00:00:00.000Z",
    claimToken: "token",
    leaseUntil: "2026-11-15T00:05:00.000Z",
    lastError: null,
  };
}

let database: DatabaseSync;
let resolvedor: SqliteResolvedorAlertaCorreo;

beforeEach(() => {
  database = openDatabase(":memory:");
  resolvedor = new SqliteResolvedorAlertaCorreo(database);
});

afterEach(() => {
  database.close();
});

describe("Datos del correo a partir de un evento de la cola (US40)", () => {
  it("una subida de tasa muestra porcentajes y variación positiva", () => {
    expect(resolvedor.resolver(notificacion({}))).toEqual({
      id: 21,
      entidad: "Entidad A",
      tipo: "CAMBIO_TASA",
      valorAnterior: "5.00%",
      valorNuevo: "6.00%",
      variacionPct: "+20.00%",
    });
  });

  it("una baja de tasa muestra la variación negativa redondeada a dos decimales", () => {
    const datos = resolvedor.resolver(notificacion({ previousValue: "0.045", currentValue: "0.038" }));

    expect(datos).toMatchObject({ valorAnterior: "4.50%", valorNuevo: "3.80%", variacionPct: "-15.56%" });
  });

  it("una tasa que no cambia muestra variación 0.00% sin signo", () => {
    const datos = resolvedor.resolver(notificacion({ previousValue: "0.05", currentValue: "0.05" }));

    expect(datos?.variacionPct).toBe("0.00%");
  });

  it("si la tasa anterior era 0 no hay variación que calcular", () => {
    const datos = resolvedor.resolver(notificacion({ previousValue: "0", currentValue: "0.05" }));

    expect(datos?.variacionPct).toBeNull();
  });

  it("un cambio de riesgo conserva las calificaciones tal cual y no tiene variación", () => {
    const datos = resolvedor.resolver(notificacion({ type: "CAMBIO_RIESGO", previousValue: "A-", currentValue: "C" }));

    expect(datos).toEqual({
      id: 21,
      entidad: "Entidad A",
      tipo: "CAMBIO_RIESGO",
      valorAnterior: "A-",
      valorNuevo: "C",
      variacionPct: null,
    });
  });

  it("devuelve null si la entidad no existe en el catálogo", () => {
    expect(resolvedor.resolver(notificacion({ entityId: 999 }))).toBeNull();
  });
});
