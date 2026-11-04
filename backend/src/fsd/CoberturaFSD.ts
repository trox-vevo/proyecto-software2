export type EstadoCoberturaFSD = "CUBIERTO" | "NO_CUBIERTO" | "NO_VERIFICADO";

export interface CoberturaFSD {
  entidadFinanciera: string | null;
  estado: EstadoCoberturaFSD;
  fechaVerificacion: string | null;
  vigenteHasta: string | null;
  fuente: string | null;
}

export function crearCoberturaNoVerificada(entidadFinanciera: string | null = null): CoberturaFSD {
  return { entidadFinanciera, estado: "NO_VERIFICADO", fechaVerificacion: null, vigenteHasta: null, fuente: null };
}

function fechaValida(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Solo se consume evidencia revisada del repositorio, nunca una deducción por nombre de cuenta.
// Sin fuente oficial y fechas vigentes, cualquier supuesto estado vuelve a NO_VERIFICADO.
export function validarCoberturaFSD(raw: unknown, hoy = new Date()): CoberturaFSD {
  if (!raw || typeof raw !== "object") return crearCoberturaNoVerificada();
  const value = raw as Record<string, unknown>;
  const entidad = typeof value.entidadFinanciera === "string" && value.entidadFinanciera.trim() ? value.entidadFinanciera.trim() : null;
  const desconocida = crearCoberturaNoVerificada(entidad);
  if (!entidad || (value.estado !== "CUBIERTO" && value.estado !== "NO_CUBIERTO")) return desconocida;
  if (!fechaValida(value.fechaVerificacion) || !fechaValida(value.vigenteHasta)) return desconocida;
  const fechaHoy = hoy.toISOString().slice(0, 10);
  if (value.fechaVerificacion > fechaHoy || value.vigenteHasta < fechaHoy || value.vigenteHasta < value.fechaVerificacion) return desconocida;
  if (typeof value.fuente !== "string") return desconocida;
  try {
    const url = new URL(value.fuente);
    if (url.protocol !== "https:" || url.username || url.password || !["fsd.org.pe", "www.fsd.org.pe", "sbs.gob.pe", "www.sbs.gob.pe"].includes(url.hostname)) return desconocida;
  } catch { return desconocida; }
  return { entidadFinanciera: entidad, estado: value.estado as "CUBIERTO" | "NO_CUBIERTO", fechaVerificacion: value.fechaVerificacion, vigenteHasta: value.vigenteHasta, fuente: value.fuente };
}
