import type { AlertaApi, CoberturaFSD, FilaAlerta, RepositorioAlertas } from "../domain/Alertas";
import { porcentaje, variacion } from "../infrastructure/SqliteResolvedorAlertaCorreo";

const NO_VERIFICADO: CoberturaFSD = {
  estado: "NO_VERIFICADO",
  entidadFinanciera: null,
  fechaVerificacion: null,
  vigenteHasta: null,
  fuente: null,
};

const texto = (valor: unknown): string | null => (typeof valor === "string" && valor.trim() ? valor : null);

/**
 * TS-105: convierte financial_entities.fsd_coverage en la cobertura de la alerta.
 * NULL, JSON roto o un estado desconocido significan "no verificado", nunca "sin cobertura".
 * La vigencia de la evidencia la valida el indicador del frontend (IndicadorFSD).
 */
export function leerCobertura(json: string | null): CoberturaFSD {
  if (json === null) return { ...NO_VERIFICADO };
  try {
    const dato: unknown = JSON.parse(json);
    if (typeof dato !== "object" || dato === null) return { ...NO_VERIFICADO };
    const campos = dato as Record<string, unknown>;
    const estado = campos.estado;
    if (estado !== "CUBIERTO" && estado !== "NO_CUBIERTO") return { ...NO_VERIFICADO };
    return {
      estado,
      entidadFinanciera: texto(campos.entidadFinanciera),
      fechaVerificacion: texto(campos.fechaVerificacion),
      vigenteHasta: texto(campos.vigenteHasta),
      fuente: texto(campos.fuente),
    };
  } catch {
    return { ...NO_VERIFICADO };
  }
}

/** Si un valor del evento no se puede formatear, se muestra tal cual en lugar de romper toda la lista. */
function seguro<T>(formatear: () => T, alternativa: T): T {
  try {
    return formatear();
  } catch {
    return alternativa;
  }
}

function aAlerta(fila: FilaAlerta): AlertaApi {
  const { event } = fila;
  const esTasa = event.type === "CAMBIO_TASA";
  return {
    id: fila.id,
    entidadId: event.entityId,
    entidad: fila.entidad ?? "Entidad no disponible",
    tipo: esTasa ? "TASA" : "RIESGO",
    tasaAnterior: esTasa ? seguro(() => porcentaje(event.previousValue), event.previousValue) : null,
    tasaNueva: esTasa ? seguro(() => porcentaje(event.currentValue), event.currentValue) : null,
    variacionPct: esTasa ? seguro(() => variacion(event.previousValue, event.currentValue), null) : null,
    calificacionAnterior: esTasa ? null : event.previousValue,
    calificacion: esTasa ? fila.calificacionActual : event.currentValue,
    coberturaFSD: leerCobertura(fila.fsdCoverage),
    leida: fila.leida,
    creadaEn: fila.creadaEn,
  };
}

export class ServicioAlertas {
  constructor(
    private readonly repositorio: RepositorioAlertas,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  listar(userId: number): AlertaApi[] {
    return this.repositorio.listarPorUsuario(userId).map(aAlerta);
  }

  /** false si la alerta no existe o es de otro usuario. */
  marcarLeida(userId: number, id: number): boolean {
    return this.repositorio.marcarLeida(userId, id, this.ahora().toISOString());
  }
}
