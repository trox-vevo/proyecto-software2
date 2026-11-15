import { useEffect } from "react";
import { IndicadorFSD } from "../fsd/IndicadorFSD";
import { nivelDeCalificacion } from "../risk/nivelDeCalificacion";
import { obtenerConfig } from "../semaforo/configSemaforo";
import type { Alerta } from "./tipos";
import "../semaforo/semaforo.css";
import "./alertas.css";

interface Props {
  alerta: Alerta;
  /** Se llama cuando el panel ya se mostró; el hook marca entonces la alerta como leída. */
  onMostrado: (id: number) => void;
  onCerrar: () => void;
}

/** Panel lateral con el detalle completo de una alerta (US36, escenario 1). Se cierra con Escape o con el botón. */
export function PanelDetalleAlerta({ alerta, onMostrado, onCerrar }: Props) {
  useEffect(() => {
    onMostrado(alerta.id);
  }, [alerta.id, onMostrado]);

  const nivel = alerta.calificacion === null ? null : nivelDeCalificacion(alerta.calificacion);
  const config = obtenerConfig(nivel);

  return (
    <aside
      className="alerta-panel"
      aria-labelledby="alerta-panel-titulo"
      onKeyDown={(event) => event.key === "Escape" && onCerrar()}
    >
      <header>
        <h3 id="alerta-panel-titulo">{alerta.entidad}</h3>
        <button type="button" onClick={onCerrar} autoFocus>
          Cerrar
        </button>
      </header>

      <dl className="alerta-panel-datos">
        <div>
          <dt>Tipo de cambio</dt>
          <dd>{alerta.tipo === "TASA" ? "Cambio de tasa" : "Cambio de riesgo"}</dd>
        </div>
        <div>
          <dt>Tasa anterior</dt>
          <dd>{alerta.tasaAnterior}</dd>
        </div>
        <div>
          <dt>Tasa nueva</dt>
          <dd>{alerta.tasaNueva}</dd>
        </div>
        <div>
          <dt>Variación</dt>
          <dd>{alerta.variacionPct}</dd>
        </div>
        {alerta.tipo === "RIESGO" && (
          <div>
            <dt>Calificación anterior</dt>
            <dd>{alerta.calificacionAnterior ?? "Sin dato"}</dd>
          </div>
        )}
        <div>
          <dt>Riesgo actualizado</dt>
          <dd className="alerta-riesgo">
            <span className="alerta-luz" style={{ backgroundColor: config.colorVar }} aria-hidden="true" />
            {alerta.calificacion !== null && <strong>{alerta.calificacion}</strong>}
            <span>{config.etiqueta}</span>
          </dd>
        </div>
        <div>
          <dt>Recibida</dt>
          <dd>{new Date(alerta.creadaEn).toLocaleString("es-PE")}</dd>
        </div>
      </dl>

      <section aria-label="Cobertura del Fondo de Seguro de Depósitos">
        <IndicadorFSD cobertura={alerta.coberturaFSD} />
      </section>
    </aside>
  );
}
