import { obtenerConfig } from "./configSemaforo";
import type { Riesgo } from "./tipos";
import "./semaforo.css";
import "./SemaforoRiesgo.css";

interface Props {
  /** Debe coincidir con el panelId del SemaforoRiesgo que lo abre. */
  id: string;
  riesgo: Riesgo | null;
}

/** Texto que se muestra al expandir el semáforo. Usa la descripción del backend si existe; si no, la de la configuración. */
export function PanelDescripcionRiesgo({ id, riesgo }: Props) {
  const config = obtenerConfig(riesgo?.nivel ?? null);

  return (
    <div id={id} className="panel-riesgo" style={{ borderLeftColor: config.colorVar }}>
      <strong>{config.etiqueta}</strong>
      <p>{riesgo?.descripcion ?? config.descripcion}</p>
    </div>
  );
}
