import { obtenerConfig } from "../semaforo/configSemaforo";
import { nivelDeCalificacion } from "./nivelDeCalificacion";
import type { SbsRiskProfile } from "./tipos";
import "../semaforo/semaforo.css";
import "./RiskIndicatorsPanel.css";

interface Props {
  profile: SbsRiskProfile;
}

// "0.1620" -> "16.20 %"
function formatPercent(value: string): string {
  return `${(Number(value) * 100).toFixed(2)} %`;
}

// "2026-09-30" -> "30/09/2026"
const formatearFecha = (fecha: string) => fecha.split("-").reverse().join("/");

/** US25 (TS-79): calificación con el semáforo de colores y los indicadores de la SBS. Lo usa el informe de la US26. */
export function RiskIndicatorsPanel({ profile }: Props) {
  const config = obtenerConfig(nivelDeCalificacion(profile.riskRating));

  function renderIndicators() {
    return (
      <dl className="indicadores-sbs-lista">
        <div>
          <dt>Ratio de capital global</dt>
          <dd>{formatPercent(profile.capitalAdequacyRatio)}</dd>
        </div>
        <div>
          <dt>Morosidad</dt>
          <dd>{formatPercent(profile.delinquencyRate)}</dd>
        </div>
        <div>
          <dt>Liquidez</dt>
          <dd>{formatPercent(profile.liquidityRatio)}</dd>
        </div>
      </dl>
    );
  }

  return (
    <section className="indicadores-sbs" aria-label={`Indicadores de riesgo de ${profile.entityName}`}>
      <p className="indicadores-sbs-calificacion">
        <span className="indicadores-sbs-luz" style={{ backgroundColor: config.colorVar }} aria-hidden="true" />
        <strong>{profile.riskRating}</strong>
        <span>{config.etiqueta}</span>
      </p>
      {renderIndicators()}
      <p className="indicadores-sbs-fuente">
        Fuente: <a href={profile.sourceUrl} target="_blank" rel="noreferrer">SBS</a>, datos al {formatearFecha(profile.reportDate)}
      </p>
    </section>
  );
}
