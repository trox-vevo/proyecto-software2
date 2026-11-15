import type { QueuedNotification } from "../../notifications/queue/domain/QueueContracts";
import type {
  BuscadorUsuarios,
  ColaCorreo,
  ContenidoCorreo,
  ProveedorCorreo,
  RegistroEnvios,
  ResolvedorAlertaCorreo,
  Temporizador,
} from "../domain/EnvioCorreo";
import { PlantillaCorreoAlerta } from "./PlantillaCorreoAlerta";
import { PoliticaReintentos } from "./PoliticaReintentos";

export interface DependenciasEnvio {
  cola: ColaCorreo;
  usuarios: BuscadorUsuarios;
  alertas: ResolvedorAlertaCorreo;
  proveedor: ProveedorCorreo;
  registro: RegistroEnvios;
  temporizador: Temporizador;
}

export interface OpcionesEnvio {
  plantilla?: PlantillaCorreoAlerta;
  politica?: PoliticaReintentos;
  /** Dirección del frontend, para el enlace al detalle de la alerta (US36). */
  frontendUrl?: string;
  ahora?: () => Date;
  /** Cuánto dura la reserva de cada notificación en la cola. Debe superar la espera total entre reintentos. */
  arriendoMs?: number;
  /** Cuántas notificaciones se reservan por lote (de 1 a 1000). */
  tamanoLote?: number;
}

export interface ResultadoEnvio {
  enviado: boolean;
  /** Intentos realizados (0 si ni siquiera se pudo preparar el correo). */
  intentos: number;
}

/** Los mensajes de error no deben guardar direcciones de correo en el registro. */
function describirError(error: unknown): string {
  const mensaje = error instanceof Error ? error.message : String(error);
  return mensaje.replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[correo]").slice(0, 200) || "Error desconocido.";
}

/**
 * TS-125: reserva notificaciones inmediatas de la cola de US39, arma el correo de cada una y lo envía.
 * Si falla, espera y reintenta (espera exponencial) hasta agotar los intentos, sin soltar la reserva.
 * Cada intento queda registrado; al final la cola recibe la entrega o el fallo (US40, escenario 2).
 * La cola nunca reintenta por su cuenta: un fallo marcado ahí es definitivo.
 */
export class ServicioEnvioCorreo {
  private readonly plantilla: PlantillaCorreoAlerta;
  private readonly politica: PoliticaReintentos;
  private readonly frontendUrl: string;
  private readonly ahora: () => Date;
  private readonly arriendoMs: number;
  private readonly tamanoLote: number;

  constructor(
    private readonly dependencias: DependenciasEnvio,
    opciones: OpcionesEnvio = {},
  ) {
    this.plantilla = opciones.plantilla ?? new PlantillaCorreoAlerta();
    this.politica = opciones.politica ?? new PoliticaReintentos();
    this.frontendUrl = opciones.frontendUrl ?? process.env.FRONTEND_URL ?? "http://localhost:5173";
    this.ahora = opciones.ahora ?? (() => new Date());
    this.arriendoMs = opciones.arriendoMs ?? 300_000;
    this.tamanoLote = opciones.tamanoLote ?? 10;
    // Si la reserva venciera durante los reintentos, otro proceso podría tomar el mismo mensaje y enviarlo dos veces.
    if (this.arriendoMs <= this.politica.esperaTotalMs()) {
      throw new RangeError("La reserva de la cola debe durar más que la espera total entre reintentos.");
    }
  }

  /** Reserva un lote de notificaciones inmediatas y las procesa una por una. Devuelve cuántas tomó. */
  async procesarLote(): Promise<number> {
    const lote = this.dependencias.cola.claimPending(
      "INMEDIATA",
      this.tamanoLote,
      this.ahora().toISOString(),
      this.arriendoMs,
    );
    for (const notificacion of lote) await this.procesar(notificacion);
    return lote.length;
  }

  /** La notificación ya debe estar reservada (con su claimToken). */
  async procesar(notificacion: QueuedNotification): Promise<ResultadoEnvio> {
    const { cola, usuarios, alertas, registro, temporizador } = this.dependencias;
    const token = notificacion.claimToken;
    if (token === null) throw new Error("La notificación no está reservada en la cola.");

    // Si faltan datos no tiene sentido reintentar: no es un fallo pasajero del servicio de correo.
    const usuario = usuarios.findById(notificacion.userId);
    if (usuario === null) return this.fallarSinReintento(notificacion, token, "El usuario de la notificación no existe.");
    const alerta = alertas.resolver(notificacion);
    if (alerta === null) return this.fallarSinReintento(notificacion, token, "No se pudo armar la alerta: la entidad no existe.");

    const contenido = this.plantilla.construir(alerta, this.enlaceA(notificacion.id));

    let ultimoError = "";
    for (let intento = 1; intento <= this.politica.maxIntentos; intento++) {
      const error = await this.intentarEnviar(usuario.email, contenido);
      registro.registrarIntento({
        notificacionId: notificacion.id,
        numero: intento,
        resultado: error === null ? "OK" : "ERROR",
        error,
        momento: this.ahora(),
      });

      if (error === null) {
        const aceptado = cola.markDelivered(notificacion.id, token, this.ahora().toISOString());
        this.avisarSiNoSeConfirmo(notificacion, aceptado, "confirmar la entrega");
        return { enviado: true, intentos: intento };
      }

      ultimoError = error;
      // No se espera después del último intento: ya no habrá otro.
      if (intento < this.politica.maxIntentos) {
        await temporizador.esperar(this.politica.retrasoTras(intento));
      }
    }

    registro.registrarAgotado(notificacion.id, ultimoError);
    const aceptado = cola.markFailed(notificacion.id, token, ultimoError, this.ahora().toISOString());
    this.avisarSiNoSeConfirmo(notificacion, aceptado, "marcar el fallo");
    return { enviado: false, intentos: this.politica.maxIntentos };
  }

  /** null si el correo salió bien; si no, el motivo del fallo. */
  private async intentarEnviar(para: string, contenido: ContenidoCorreo): Promise<string | null> {
    try {
      const aceptado = await this.dependencias.proveedor.enviar(para, contenido);
      return aceptado ? null : "El proveedor de correo no aceptó el mensaje.";
    } catch (error: unknown) {
      return describirError(error);
    }
  }

  private fallarSinReintento(notificacion: QueuedNotification, token: string, motivo: string): ResultadoEnvio {
    this.dependencias.registro.registrarAgotado(notificacion.id, motivo);
    const aceptado = this.dependencias.cola.markFailed(notificacion.id, token, motivo, this.ahora().toISOString());
    this.avisarSiNoSeConfirmo(notificacion, aceptado, "marcar el fallo");
    return { enviado: false, intentos: 0 };
  }

  /** La cola devuelve false si la reserva venció o el token ya no vale: conviene dejar constancia. */
  private avisarSiNoSeConfirmo(notificacion: QueuedNotification, aceptado: boolean, accion: string): void {
    if (!aceptado) {
      this.dependencias.registro.registrarAviso(
        notificacion.id,
        `No se pudo ${accion} en la cola: la reserva venció o ya no es válida.`,
      );
    }
  }

  /** Enlace que abre la plataforma con el detalle de esa alerta (lo entiende useAlertas en el frontend). */
  private enlaceA(notificacionId: number): string {
    const url = new URL("/", this.frontendUrl);
    url.searchParams.set("alerta", String(notificacionId));
    return url.toString();
  }
}
