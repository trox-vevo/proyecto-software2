import { obtenerConfig } from "./configSemaforo";
import type { Riesgo } from "./tipos";
import "./semaforo.css";
import "./SemaforoRiesgo.css";

interface Props {
  riesgo: Riesgo | null;
  expandido: boolean;
  /** id del panel que abre este botón (para aria-controls). */
  panelId: string;
  onToggle: () => void;
}

/** Botón con la luz de color y la etiqueta del nivel. Solo dibuja: no sabe de filas ni de la tabla. */
export function SemaforoRiesgo({ riesgo, expandido, panelId, onToggle }: Props) {
  const config = obtenerConfig(riesgo?.nivel ?? null);

  return (
    <button
      type="button"
      className="semaforo"
      aria-expanded={expandido}
      aria-controls={panelId}
      onClick={onToggle}
    >
      <span className="semaforo-luz" style={{ backgroundColor: config.colorVar }} aria-hidden="true" />
      <span className="semaforo-etiqueta">{config.etiqueta}</span>
    </button>
  );
}
