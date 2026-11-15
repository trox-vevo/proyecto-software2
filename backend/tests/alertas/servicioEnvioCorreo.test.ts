import { describe, expect, it } from "vitest";
import { PoliticaReintentos } from "../../src/alertas/application/PoliticaReintentos";
import { ServicioEnvioCorreo } from "../../src/alertas/application/ServicioEnvioCorreo";
import type {
  ColaCorreo,
  ContenidoCorreo,
  DatosAlertaCorreo,
  IntentoEnvio,
  ProveedorCorreo,
  RegistroEnvios,
  ResolvedorAlertaCorreo,
  Temporizador,
} from "../../src/alertas/domain/EnvioCorreo";
import type { NotificationFrequency } from "../../src/notifications/NotificationPreferences";
import type { QueuedNotification } from "../../src/notifications/queue/domain/QueueContracts";

// Piezas falsas: ningún correo sale de verdad, la cola es de memoria y las pruebas no esperan tiempo real.

const AHORA = new Date("2026-11-15T12:00:00.000Z");

const ALERTA: DatosAlertaCorreo = {
  id: 12,
  entidad: "Entidad A",
  tipo: "CAMBIO_TASA",
  valorAnterior: "5.00%",
  valorNuevo: "6.00%",
  variacionPct: "+20.00%",
};

function notificacion(id = 12): QueuedNotification {
  return {
    id,
    userId: 7,
    frequency: "INMEDIATA",
    availableAt: "2026-11-14T00:00:00.000Z",
    event: {
      eventId: `cambio-${id}`,
      entityId: 1,
      type: "CAMBIO_TASA",
      previousValue: "0.05",
      currentValue: "0.06",
      occurredAt: "2026-11-14T00:00:00.000Z",
    },
    idempotencyKey: `clave-${id}`,
    status: "CLAIMED",
    createdAt: "2026-11-14T00:00:00.000Z",
    claimToken: `token-${id}`,
    leaseUntil: "2026-11-15T12:05:00.000Z",
    lastError: null,
  };
}

class ProveedorFalso implements ProveedorCorreo {
  llamadas: Array<{ para: string; contenido: ContenidoCorreo }> = [];

  /** Los primeros `fallos` envíos fallan: lanzando un error o, en modo "rechazo", devolviendo false. */
  constructor(
    private readonly fallos: number,
    private readonly modo: "excepcion" | "rechazo" = "excepcion",
  ) {}

  async enviar(para: string, contenido: ContenidoCorreo): Promise<boolean> {
    this.llamadas.push({ para, contenido });
    if (this.llamadas.length <= this.fallos) {
      if (this.modo === "rechazo") return false;
      throw new Error("fallo simulado de SMTP para persona@correo.com");
    }
    return true;
  }
}

class RegistroEnMemoria implements RegistroEnvios {
  intentos: IntentoEnvio[] = [];
  agotados: Array<{ notificacionId: number; error: string }> = [];
  avisos: Array<{ notificacionId: number; mensaje: string }> = [];

  registrarIntento(intento: IntentoEnvio): void {
    this.intentos.push(intento);
  }

  registrarAgotado(notificacionId: number, error: string): void {
    this.agotados.push({ notificacionId, error });
  }

  registrarAviso(notificacionId: number, mensaje: string): void {
    this.avisos.push({ notificacionId, mensaje });
  }
}

class ColaFalsa implements ColaCorreo {
  reclamos: Array<{ frecuencia: NotificationFrequency; limite: number; ahora: string; arriendoMs: number }> = [];
  entregadas: Array<{ id: number; token: string }> = [];
  falladas: Array<{ id: number; token: string; error: string }> = [];

  /** `confirma` = false simula que la reserva venció y la cola rechaza la confirmación. */
  constructor(
    private readonly pendientes: QueuedNotification[] = [],
    private readonly confirma = true,
  ) {}

  claimPending(frecuencia: NotificationFrequency, limite: number, ahora: string, arriendoMs: number): QueuedNotification[] {
    this.reclamos.push({ frecuencia, limite, ahora, arriendoMs });
    return this.pendientes.splice(0, limite);
  }

  markDelivered(id: number, token: string): boolean {
    this.entregadas.push({ id, token });
    return this.confirma;
  }

  markFailed(id: number, token: string, error: string): boolean {
    this.falladas.push({ id, token, error });
    return this.confirma;
  }
}

class TemporizadorFalso implements Temporizador {
  esperas: number[] = [];

  async esperar(ms: number): Promise<void> {
    this.esperas.push(ms);
  }
}

function crear(
  opciones: {
    fallos?: number;
    modo?: "excepcion" | "rechazo";
    usuarioExiste?: boolean;
    alertaExiste?: boolean;
    pendientes?: QueuedNotification[];
    colaConfirma?: boolean;
  } = {},
) {
  const proveedor = new ProveedorFalso(opciones.fallos ?? 0, opciones.modo);
  const registro = new RegistroEnMemoria();
  const cola = new ColaFalsa(opciones.pendientes ?? [notificacion()], opciones.colaConfirma ?? true);
  const temporizador = new TemporizadorFalso();
  const alertas: ResolvedorAlertaCorreo = { resolver: () => (opciones.alertaExiste === false ? null : ALERTA) };
  const servicio = new ServicioEnvioCorreo(
    {
      cola,
      usuarios: { findById: (id) => (opciones.usuarioExiste === false || id !== 7 ? null : { email: "ana@ejemplo.com" }) },
      alertas,
      proveedor,
      registro,
      temporizador,
    },
    { frontendUrl: "https://yupay.test", ahora: () => AHORA },
  );
  return { servicio, proveedor, registro, cola, temporizador };
}

describe("Servicio de envío de correo con reintentos (US40, TS-125 y TS-126)", () => {
  it("escenario 1: envía el correo al primer intento, lo registra y confirma la entrega en la cola", async () => {
    const { servicio, proveedor, registro, cola, temporizador } = crear();

    const resultado = await servicio.procesar(notificacion());

    expect(resultado).toEqual({ enviado: true, intentos: 1 });
    expect(proveedor.llamadas).toHaveLength(1);
    expect(proveedor.llamadas[0].para).toBe("ana@ejemplo.com");
    expect(proveedor.llamadas[0].contenido.asunto).toContain("Entidad A");
    expect(proveedor.llamadas[0].contenido.texto).toContain("https://yupay.test/?alerta=12");
    expect(registro.intentos.map((i) => i.resultado)).toEqual(["OK"]);
    expect(registro.agotados).toHaveLength(0);
    expect(cola.entregadas).toEqual([{ id: 12, token: "token-12" }]);
    expect(temporizador.esperas).toEqual([]);
  });

  it("escenario 2: si falla dos veces y luego funciona, reintenta con espera exponencial y lo entrega", async () => {
    const { servicio, proveedor, registro, cola, temporizador } = crear({ fallos: 2 });

    const resultado = await servicio.procesar(notificacion());

    expect(resultado).toEqual({ enviado: true, intentos: 3 });
    expect(proveedor.llamadas).toHaveLength(3);
    expect(temporizador.esperas).toEqual([1000, 2000]);
    expect(registro.intentos.map((i) => [i.numero, i.resultado])).toEqual([
      [1, "ERROR"],
      [2, "ERROR"],
      [3, "OK"],
    ]);
    expect(registro.agotados).toHaveLength(0);
    expect(cola.entregadas).toEqual([{ id: 12, token: "token-12" }]);
  });

  it("escenario 2: si los 3 intentos fallan, registra el error final y marca la notificación como fallida en la cola", async () => {
    const { servicio, proveedor, registro, cola, temporizador } = crear({ fallos: Infinity });

    const resultado = await servicio.procesar(notificacion());

    expect(resultado).toEqual({ enviado: false, intentos: 3 });
    expect(proveedor.llamadas).toHaveLength(3);
    // No se espera después del último intento
    expect(temporizador.esperas).toEqual([1000, 2000]);
    expect(registro.intentos.map((i) => i.resultado)).toEqual(["ERROR", "ERROR", "ERROR"]);
    expect(registro.agotados).toHaveLength(1);
    expect(registro.agotados[0].notificacionId).toBe(12);
    expect(cola.falladas).toHaveLength(1);
    expect(cola.falladas[0]).toMatchObject({ id: 12, token: "token-12" });
    expect(cola.falladas[0].error.length).toBeGreaterThan(0);
    expect(cola.entregadas).toEqual([]);
  });

  it("que el proveedor rechace el correo (devuelva false) también cuenta como fallo", async () => {
    const { servicio, registro } = crear({ fallos: 1, modo: "rechazo" });

    const resultado = await servicio.procesar(notificacion());

    expect(resultado).toEqual({ enviado: true, intentos: 2 });
    expect(registro.intentos[0]).toMatchObject({ numero: 1, resultado: "ERROR" });
    expect(registro.intentos[0].error).toContain("no aceptó");
  });

  it("el registro y la cola no guardan direcciones de correo, ni siquiera dentro del mensaje de error", async () => {
    const { servicio, registro, cola } = crear({ fallos: Infinity });

    await servicio.procesar(notificacion());

    const texto = JSON.stringify([registro.intentos, registro.agotados, cola.falladas]);
    expect(texto).not.toContain("persona@correo.com");
    expect(texto).not.toContain("ana@ejemplo.com");
    expect(texto).toContain("[correo]");
  });

  it("si el usuario no existe no envía nada ni reintenta: marca la notificación como fallida", async () => {
    const { servicio, proveedor, registro, cola, temporizador } = crear({ usuarioExiste: false });

    const resultado = await servicio.procesar(notificacion());

    expect(resultado).toEqual({ enviado: false, intentos: 0 });
    expect(proveedor.llamadas).toHaveLength(0);
    expect(temporizador.esperas).toEqual([]);
    expect(registro.agotados).toHaveLength(1);
    expect(cola.falladas).toHaveLength(1);
  });

  it("si la entidad de la alerta no existe tampoco envía nada", async () => {
    const { servicio, proveedor, cola } = crear({ alertaExiste: false });

    const resultado = await servicio.procesar(notificacion());

    expect(resultado).toEqual({ enviado: false, intentos: 0 });
    expect(proveedor.llamadas).toHaveLength(0);
    expect(cola.falladas).toHaveLength(1);
  });

  it("si la cola rechaza la confirmación (reserva vencida), el envío cuenta pero queda un aviso", async () => {
    const { servicio, registro } = crear({ colaConfirma: false });

    const resultado = await servicio.procesar(notificacion());

    expect(resultado).toEqual({ enviado: true, intentos: 1 });
    expect(registro.avisos).toHaveLength(1);
    expect(registro.avisos[0].notificacionId).toBe(12);
  });

  it("no procesa una notificación que no está reservada", async () => {
    const { servicio } = crear();

    await expect(servicio.procesar({ ...notificacion(), claimToken: null })).rejects.toThrow("reservada");
  });

  it("procesarLote reserva solo notificaciones inmediatas, con límite y reserva definidos, y devuelve cuántas tomó", async () => {
    const { servicio, cola, proveedor } = crear({ pendientes: [notificacion(12), notificacion(13)] });

    expect(await servicio.procesarLote()).toBe(2);

    expect(cola.reclamos).toEqual([
      { frecuencia: "INMEDIATA", limite: 10, ahora: "2026-11-15T12:00:00.000Z", arriendoMs: 300_000 },
    ]);
    expect(proveedor.llamadas).toHaveLength(2);
    expect(cola.entregadas.map((e) => e.id)).toEqual([12, 13]);
    expect(await servicio.procesarLote()).toBe(0);
  });

  it("rechaza una reserva más corta que la espera total entre reintentos", () => {
    const dependencias = {
      cola: new ColaFalsa(),
      usuarios: { findById: () => null },
      alertas: { resolver: () => null },
      proveedor: new ProveedorFalso(0),
      registro: new RegistroEnMemoria(),
      temporizador: new TemporizadorFalso(),
    };

    expect(() => new ServicioEnvioCorreo(dependencias, { arriendoMs: 1000 })).toThrow(RangeError);
  });
});

describe("Política de reintentos", () => {
  it("la espera se duplica en cada intento", () => {
    const politica = new PoliticaReintentos();

    expect([1, 2, 3].map((intento) => politica.retrasoTras(intento))).toEqual([1000, 2000, 4000]);
  });

  it("la espera total suma las esperas entre intentos, sin contar el último", () => {
    expect(new PoliticaReintentos().esperaTotalMs()).toBe(3000);
    expect(new PoliticaReintentos(1).esperaTotalMs()).toBe(0);
  });

  it("por defecto son 3 intentos en total", () => {
    expect(new PoliticaReintentos().maxIntentos).toBe(3);
  });

  it("rechaza valores inválidos", () => {
    expect(() => new PoliticaReintentos(0)).toThrow(RangeError);
    expect(() => new PoliticaReintentos(2.5)).toThrow(RangeError);
    expect(() => new PoliticaReintentos(3, -1)).toThrow(RangeError);
  });
});
