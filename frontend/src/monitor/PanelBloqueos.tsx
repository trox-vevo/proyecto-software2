import type { EventoBloqueo, TipoBloqueo } from "./tipos";
import "./PanelBloqueos.css";

const ETIQUETAS: Record<TipoBloqueo, string> = {
  RENDER_LENTO: "Render lento",
  SIN_RESPUESTA: "Sin respuesta",
  ERROR_CARGA: "Error de carga",
};

interface Props {
  eventos: EventoBloqueo[];
  umbralMs: number;
}

/** Lista los bloqueos que ha registrado el monitor, el más reciente primero. */
export function PanelBloqueos({ eventos, umbralMs }: Props) {
  return (
    <details className="panel-bloqueos">
      <summary>
        Bloqueos detectados: {eventos.length} (umbral: {umbralMs} ms)
      </summary>
      {eventos.length === 0 ? (
        <p>No se han detectado bloqueos.</p>
      ) : (
        <ul>
          {eventos
            .map((evento, indice) => ({ evento, indice }))
            .reverse()
            .map(({ evento, indice }) => (
              <li key={indice}>
                <strong>{ETIQUETAS[evento.tipo]}</strong> · {evento.duracionMs} ms · {evento.componente} ·{" "}
                {evento.momento.toLocaleTimeString()}
              </li>
            ))}
        </ul>
      )}
    </details>
  );
}
