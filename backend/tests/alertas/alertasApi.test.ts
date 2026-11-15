import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import express from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ServicioAlertas, leerCobertura } from "../../src/alertas/application/ServicioAlertas";
import type { AlertaApi } from "../../src/alertas/domain/Alertas";
import { SqliteAlertasRepository } from "../../src/alertas/infrastructure/SqliteAlertasRepository";
import { createAlertasRouter } from "../../src/alertas/interface/alertasRoutes";
import { SqliteNotificationQueueRepository } from "../../src/notifications/queue/infrastructure/SqliteNotificationQueueRepository";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";

// Base real en memoria (catálogo de demostración) y un servidor Express mínimo con la sesión simulada
// mediante el encabezado x-test-user. No se envía ningún correo.

const AHORA = new Date("2026-11-15T12:00:00.000Z");

interface Entorno {
  database: DatabaseSync;
  url: string;
  cerrar: () => Promise<void>;
}

async function crearEntorno(): Promise<Entorno> {
  const database = openDatabase(":memory:");
  new SqliteNotificationQueueRepository(database); // crea market_notification_queue
  database.exec("PRAGMA foreign_keys = OFF"); // las pruebas no crean usuarios reales
  const servicio = new ServicioAlertas(new SqliteAlertasRepository(database), () => AHORA);

  const app = express();
  app.use((req, _res, next) => {
    const usuario = req.header("x-test-user");
    if (usuario) (req as unknown as { userId?: number }).userId = Number(usuario);
    next();
  });
  app.use(
    "/api/alertas",
    createAlertasRouter(servicio, async (req) => (req as unknown as { userId?: number }).userId ?? null),
  );

  const servidor = app.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const { port } = servidor.address() as AddressInfo;
  return {
    database,
    url: `http://127.0.0.1:${port}`,
    cerrar: async () => {
      servidor.closeAllConnections();
      await new Promise<void>((resolver) => servidor.close(() => resolver()));
      database.close();
    },
  };
}

interface Insertar {
  userId: number;
  eventId: string;
  tipo: "CAMBIO_TASA" | "CAMBIO_RIESGO";
  entityId: number;
  anterior: string;
  actual: string;
  frecuencia?: "INMEDIATA" | "RESUMEN_DIARIO";
}

/** Inserta una fila de la cola tal como la guardaría SqliteNotificationQueueRepository. */
function insertar(database: DatabaseSync, datos: Insertar): number {
  const event = {
    eventId: datos.eventId,
    entityId: datos.entityId,
    type: datos.tipo,
    previousValue: datos.anterior,
    currentValue: datos.actual,
    occurredAt: "2026-11-14T00:00:00.000Z",
  };
  const resultado = database
    .prepare(
      `INSERT INTO market_notification_queue
       (event_id, event_json, user_id, frequency, idempotency_key, status, available_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'SENT', '2026-11-14T00:00:00.000Z', '2026-11-14T00:00:01.000Z')`,
    )
    .run(datos.eventId, JSON.stringify(event), datos.userId, datos.frecuencia ?? "INMEDIATA", JSON.stringify([datos.eventId, datos.userId]));
  return Number(resultado.lastInsertRowid);
}

describe("Alertas en la plataforma (US35, US36, TS-110)", () => {
  let entorno: Entorno;

  const listar = async (usuario?: number) => {
    const respuesta = await fetch(`${entorno.url}/api/alertas`, { headers: usuario ? { "x-test-user": String(usuario) } : {} });
    const cuerpo = (await respuesta.json()) as { alertas?: AlertaApi[] };
    return { status: respuesta.status, alertas: cuerpo.alertas ?? [] };
  };
  const marcar = async (id: string | number, usuario?: number) => {
    const respuesta = await fetch(`${entorno.url}/api/alertas/${id}/leida`, {
      method: "PATCH",
      headers: usuario ? { "x-test-user": String(usuario) } : {},
    });
    return { status: respuesta.status, cuerpo: (await respuesta.json()) as Record<string, unknown> };
  };

  beforeEach(async () => {
    entorno = await crearEntorno();
  });
  afterEach(async () => {
    await entorno.cerrar();
  });

  it("sin sesión responde 401 en ambos endpoints", async () => {
    expect((await listar()).status).toBe(401);
    expect((await marcar(1)).status).toBe(401);
  });

  it("lista solo las alertas inmediatas del usuario, de la más reciente a la más antigua", async () => {
    const primera = insertar(entorno.database, { userId: 7, eventId: "e1", tipo: "CAMBIO_TASA", entityId: 1, anterior: "0.05", actual: "0.06" });
    const segunda = insertar(entorno.database, { userId: 7, eventId: "e2", tipo: "CAMBIO_TASA", entityId: 2, anterior: "0.06", actual: "0.05" });
    insertar(entorno.database, { userId: 8, eventId: "e3", tipo: "CAMBIO_TASA", entityId: 1, anterior: "0.05", actual: "0.06" });
    insertar(entorno.database, { userId: 7, eventId: "e4", tipo: "CAMBIO_TASA", entityId: 1, anterior: "0.05", actual: "0.06", frecuencia: "RESUMEN_DIARIO" });

    const { status, alertas } = await listar(7);

    expect(status).toBe(200);
    expect(alertas.map((alerta) => alerta.id)).toEqual([segunda, primera]);
  });

  it("una alerta de tasa trae entidad, tasas en porcentaje, variación y la calificación vigente de la SBS", async () => {
    insertar(entorno.database, { userId: 7, eventId: "e1", tipo: "CAMBIO_TASA", entityId: 1, anterior: "0.05", actual: "0.06" });

    const [alerta] = (await listar(7)).alertas;

    expect(alerta).toMatchObject({
      entidadId: 1,
      entidad: "Entidad A",
      tipo: "TASA",
      tasaAnterior: "5.00%",
      tasaNueva: "6.00%",
      variacionPct: "+20.00%",
      calificacionAnterior: null,
      calificacion: "A+",
      leida: false,
      creadaEn: "2026-11-14T00:00:01.000Z",
    });
  });

  it("una alerta de riesgo trae las calificaciones del evento y ninguna tasa", async () => {
    insertar(entorno.database, { userId: 7, eventId: "e1", tipo: "CAMBIO_RIESGO", entityId: 4, anterior: "B+", actual: "C" });

    const [alerta] = (await listar(7)).alertas;

    expect(alerta).toMatchObject({
      tipo: "RIESGO",
      entidad: "Entidad D",
      tasaAnterior: null,
      tasaNueva: null,
      variacionPct: null,
      calificacionAnterior: "B+",
      calificacion: "C",
    });
  });

  it("la cobertura FSD sale de la entidad: no verificada si es NULL, y la evidencia guardada si existe", async () => {
    insertar(entorno.database, { userId: 7, eventId: "e1", tipo: "CAMBIO_TASA", entityId: 1, anterior: "0.05", actual: "0.06" });
    insertar(entorno.database, { userId: 7, eventId: "e2", tipo: "CAMBIO_TASA", entityId: 2, anterior: "0.06", actual: "0.07" });
    entorno.database
      .prepare("UPDATE financial_entities SET fsd_coverage = ? WHERE id = 2")
      .run(
        JSON.stringify({
          estado: "CUBIERTO",
          entidadFinanciera: "Entidad B",
          fechaVerificacion: "2026-01-15",
          vigenteHasta: "2099-12-31",
          fuente: "https://fsd.org.pe/",
        }),
      );

    const { alertas } = await listar(7);
    const entidadB = alertas.find((alerta) => alerta.entidadId === 2);
    const entidadA = alertas.find((alerta) => alerta.entidadId === 1);

    expect(entidadA?.coberturaFSD.estado).toBe("NO_VERIFICADO");
    expect(entidadB?.coberturaFSD).toEqual({
      estado: "CUBIERTO",
      entidadFinanciera: "Entidad B",
      fechaVerificacion: "2026-01-15",
      vigenteHasta: "2099-12-31",
      fuente: "https://fsd.org.pe/",
    });
  });

  it("si la entidad del evento no existe, la alerta igual se lista como no verificada", async () => {
    insertar(entorno.database, { userId: 7, eventId: "e1", tipo: "CAMBIO_TASA", entityId: 999, anterior: "0.05", actual: "0.06" });

    const [alerta] = (await listar(7)).alertas;

    expect(alerta.entidad).toBe("Entidad no disponible");
    expect(alerta.calificacion).toBeNull();
    expect(alerta.coberturaFSD.estado).toBe("NO_VERIFICADO");
  });

  it("marcar como leída se guarda: la alerta sale leída después y el contador baja", async () => {
    const id = insertar(entorno.database, { userId: 7, eventId: "e1", tipo: "CAMBIO_TASA", entityId: 1, anterior: "0.05", actual: "0.06" });
    insertar(entorno.database, { userId: 7, eventId: "e2", tipo: "CAMBIO_TASA", entityId: 2, anterior: "0.06", actual: "0.07" });

    const respuesta = await marcar(id, 7);
    const { alertas } = await listar(7);

    expect(respuesta).toEqual({ status: 200, cuerpo: { id, leida: true } });
    expect(alertas.find((alerta) => alerta.id === id)?.leida).toBe(true);
    expect(alertas.filter((alerta) => !alerta.leida)).toHaveLength(1);
  });

  it("marcar dos veces la misma alerta no falla y conserva la primera fecha de lectura", async () => {
    const id = insertar(entorno.database, { userId: 7, eventId: "e1", tipo: "CAMBIO_TASA", entityId: 1, anterior: "0.05", actual: "0.06" });

    expect((await marcar(id, 7)).status).toBe(200);
    expect((await marcar(id, 7)).status).toBe(200);

    const filas = entorno.database.prepare("SELECT * FROM alert_reads").all() as unknown as Array<{ read_at: string }>;
    expect(filas).toHaveLength(1);
    expect(filas[0].read_at).toBe(AHORA.toISOString());
  });

  it("no se puede marcar la alerta de otro usuario: responde 404 y no cambia nada", async () => {
    const id = insertar(entorno.database, { userId: 8, eventId: "e1", tipo: "CAMBIO_TASA", entityId: 1, anterior: "0.05", actual: "0.06" });

    expect((await marcar(id, 7)).status).toBe(404);

    expect((await listar(8)).alertas[0].leida).toBe(false);
  });

  it("una alerta que no existe o de un resumen diario responde 404", async () => {
    const resumen = insertar(entorno.database, { userId: 7, eventId: "e1", tipo: "CAMBIO_TASA", entityId: 1, anterior: "0.05", actual: "0.06", frecuencia: "RESUMEN_DIARIO" });

    expect((await marcar(9999, 7)).status).toBe(404);
    expect((await marcar(resumen, 7)).status).toBe(404);
  });

  it.each(["0", "-1", "abc", "1.5", "99999999999999999999"])("el identificador %s responde 400", async (id) => {
    expect((await marcar(id, 7)).status).toBe(400);
  });
});

describe("Lectura de la cobertura FSD guardada", () => {
  it("NULL, JSON roto o un estado desconocido significan no verificado", () => {
    for (const json of [null, "{no es json", "[]", "5", '{"estado":"OTRO"}', '{"estado":"NO_VERIFICADO"}']) {
      expect(leerCobertura(json).estado).toBe("NO_VERIFICADO");
    }
  });

  it("los campos que faltan quedan en null", () => {
    expect(leerCobertura('{"estado":"NO_CUBIERTO"}')).toEqual({
      estado: "NO_CUBIERTO",
      entidadFinanciera: null,
      fechaVerificacion: null,
      vigenteHasta: null,
      fuente: null,
    });
  });
});
