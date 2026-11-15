import { IndicadorFSD } from "../fsd/IndicadorFSD";
import type { Alerta } from "./tipos";
import "./alertas.css";

interface Props {
  alerta: Alerta;
  /** true si su detalle está abierto en el panel lateral. */
  seleccionada: boolean;
  onAbrir: (id: number) => void;
}

/** Una alerta en la lista: entidad, resumen del cambio e indicador FSD con tooltip. Solo dibuja. */
export function NotificacionVisual({ alerta, seleccionada, onAbrir }: Props) {
  const resumen =
    alerta.tipo === "TASA"
      ? `Tasa: ${alerta.tasaAnterior} → ${alerta.tasaNueva} (${alerta.variacionPct})`
      : `Riesgo: ${alerta.calificacionAnterior ?? "sin dato"} → ${alerta.calificacion ?? "sin dato"}`;
  const clases = ["alerta-item", alerta.leida ? "" : "alerta-item-nueva", seleccionada ? "alerta-item-activa" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={clases}>
      <button
        type="button"
        className="alerta-item-boton"
        aria-current={seleccionada ? "true" : undefined}
        onClick={() => onAbrir(alerta.id)}
      >
        <span>
          {!alerta.leida && <span className="alerta-punto" aria-hidden="true" />}
          <strong>{alerta.entidad}</strong>
          {!alerta.leida && <span className="alerta-solo-lector"> (no leída)</span>}
        </span>
        <span>{resumen}</span>
      </button>
      <IndicadorFSD cobertura={alerta.coberturaFSD} variante="compacto" />
    </li>
  );
}
