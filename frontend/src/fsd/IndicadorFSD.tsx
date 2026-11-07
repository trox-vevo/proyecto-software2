import "./IndicadorFSD.css";

export interface CoberturaFSD {
  estado: "CUBIERTO" | "NO_CUBIERTO" | "NO_VERIFICADO";
  entidadFinanciera: string | null;
  fechaVerificacion: string | null;
  vigenteHasta: string | null;
  fuente: string | null;
}

function evidenciaVigente(value: CoberturaFSD | undefined): value is CoberturaFSD {
  if (typeof value?.entidadFinanciera !== "string" || !value.entidadFinanciera.trim() || typeof value.fechaVerificacion !== "string" || typeof value.vigenteHasta !== "string" || typeof value.fuente !== "string") return false;
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaValida = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!fechaValida(value.fechaVerificacion) || !fechaValida(value.vigenteHasta) || value.fechaVerificacion > hoy || value.vigenteHasta < hoy || value.fechaVerificacion > value.vigenteHasta) return false;
  try {
    const url = new URL(value.fuente);
    return url.protocol === "https:" && !url.username && !url.password && ["fsd.org.pe", "www.fsd.org.pe", "sbs.gob.pe", "www.sbs.gob.pe"].includes(url.hostname);
  } catch { return false; }
}

export function IndicadorFSD({ cobertura }: { cobertura?: CoberturaFSD }) {
  const estado = evidenciaVigente(cobertura) && ["CUBIERTO", "NO_CUBIERTO"].includes(cobertura.estado) ? cobertura.estado : "NO_VERIFICADO";
  const labels = { CUBIERTO: "Con cobertura FSD", NO_CUBIERTO: "Sin cobertura FSD", NO_VERIFICADO: "Cobertura FSD no verificada" };
  return <div className={`fsd-indicador fsd-${estado.toLowerCase()}`}>
    <span aria-hidden="true">{estado === "CUBIERTO" ? "🛡" : estado === "NO_CUBIERTO" ? "⊘" : "?"}</span>{" "}
    <span>{labels[estado]}</span>
    {estado === "NO_VERIFICADO" ? <small>No se dispone de evidencia vigente. No implica ausencia de cobertura.</small> : <>
      <small>{cobertura!.entidadFinanciera} · Verificado: {cobertura!.fechaVerificacion} · Vigente hasta: {cobertura!.vigenteHasta}</small>
      <a href={cobertura!.fuente!} target="_blank" rel="noreferrer">Consultar fuente oficial FSD</a>
      {estado === "CUBIERTO" && <small>Sujeto a los límites y condiciones vigentes del FSD.</small>}
    </>}
  </div>;
}
