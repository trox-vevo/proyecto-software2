import type { EventoBloqueo, TipoBloqueo, VistaObservable } from "./tipos";

interface BloqueoDetectado {
  /** Identifica el bloqueo: tipo + carga en la que ocurrió. Sirve para no registrarlo dos veces. */
  clave: string;
  tipo: TipoBloqueo;
  duracionMs: number;
}

/**
 * Vigila una vista y registra un EventoBloqueo cuando la interfaz se traba:
 *  - SIN_RESPUESTA: los datos tardaron `umbralMs` o más en llegar (o todavía no llegan).
 *  - ERROR_CARGA:   la carga falló.
 *  - RENDER_LENTO:  la tabla tardó `umbralMs` o más en dibujarse después de recibir los datos.
 * Cada bloqueo se registra una sola vez por carga.
 */
export class MonitorBloqueosUI {
  private readonly umbralMs: number;
  private readonly componente: string;
  private readonly reloj: () => number;
  private readonly eventos: EventoBloqueo[] = [];
  private readonly reportados = new Set<string>();
  private pendientes: BloqueoDetectado[] = [];
  private vista: VistaObservable | null = null;

  constructor(umbralMs: number, componente: string, reloj: () => number = () => performance.now()) {
    this.umbralMs = umbralMs;
    this.componente = componente;
    this.reloj = reloj;
  }

  getUmbralMs(): number {
    return this.umbralMs;
  }

  /** Empieza a vigilar esta vista. */
  observar(vista: VistaObservable): void {
    this.vista = vista;
  }

  /**
   * Mira la vista ahora mismo. Devuelve true si hay algún bloqueo que aún no se registró.
   * Solo detecta: no registra nada (eso lo hace revisar()), así que se puede llamar las veces que sea.
   */
  detectarBloqueo(): boolean {
    this.pendientes = [];
    if (this.vista === null) return false;

    const foto = this.vista.obtenerInstantanea();
    const ahora = this.reloj();

    const esperaMs = (foto.finCargaMs ?? ahora) - foto.inicioCargaMs;
    if (esperaMs >= this.umbralMs) {
      this.marcar("SIN_RESPUESTA", foto.inicioCargaMs, esperaMs);
    }

    if (foto.estado === "ERROR") {
      this.marcar("ERROR_CARGA", foto.inicioCargaMs, esperaMs);
    }

    if (foto.finCargaMs !== null && foto.renderListoMs !== null) {
      const renderMs = foto.renderListoMs - foto.finCargaMs;
      if (renderMs >= this.umbralMs) {
        this.marcar("RENDER_LENTO", foto.inicioCargaMs, renderMs);
      }
    }

    return this.pendientes.length > 0;
  }

  registrarEvento(evento: EventoBloqueo): void {
    this.eventos.push(evento);
  }

  /** Una revisión completa: detecta, crea los eventos y los registra. */
  revisar(): void {
    if (!this.detectarBloqueo()) return;

    for (const bloqueo of this.pendientes) {
      this.reportados.add(bloqueo.clave);
      this.registrarEvento({
        tipo: bloqueo.tipo,
        momento: new Date(),
        duracionMs: bloqueo.duracionMs,
        componente: this.componente,
      });
    }
    this.pendientes = [];
  }

  obtenerEventos(): EventoBloqueo[] {
    return [...this.eventos];
  }

  /** Anota el bloqueo como pendiente, salvo que ya se haya registrado para esta misma carga. */
  private marcar(tipo: TipoBloqueo, inicioCargaMs: number, duracionMs: number): void {
    const clave = `${tipo}:${inicioCargaMs}`;
    if (this.reportados.has(clave)) return;
    this.pendientes.push({ clave, tipo, duracionMs: Math.round(duracionMs) });
  }
}
