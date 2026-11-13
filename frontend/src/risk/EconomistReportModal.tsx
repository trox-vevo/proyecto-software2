import { RiskIndicatorsPanel } from "./RiskIndicatorsPanel";
import type { EconomistReport } from "./tipos";
import "./EconomistReportModal.css";

interface Props {
  /** null: la ventana está cerrada */
  report: EconomistReport | null;
  onClose: () => void;
}

// "2026-10-15" -> "15/10/2026"
const formatearFecha = (fecha: string) => fecha.split("-").reverse().join("/");

/** US26 (TS-81): ventana con el informe del economista. Se cierra con Escape o con el botón Cerrar. */
export function EconomistReportModal({ report, onClose }: Props) {
  if (!report) return null;

  function close() {
    onClose();
  }

  function renderSections(informe: EconomistReport) {
    return (
      <>
        <section>
          <h3>Resumen</h3>
          <p>{informe.summary}</p>
        </section>
        {informe.sbsProfile && (
          <section>
            <h3>Indicadores de la SBS</h3>
            <RiskIndicatorsPanel profile={informe.sbsProfile} />
          </section>
        )}
        <section>
          <h3>Fortalezas</h3>
          <ul>{informe.strengths.map((texto) => <li key={texto}>{texto}</li>)}</ul>
        </section>
        <section>
          <h3>Riesgos</h3>
          <ul>{informe.risks.map((texto) => <li key={texto}>{texto}</li>)}</ul>
        </section>
        <section>
          <h3>Recomendación</h3>
          <p>{informe.recommendation}</p>
        </section>
      </>
    );
  }

  // Arma la ventana; igual que PaywallModal (US27) para que se vean parecidas
  function open(informe: EconomistReport) {
    return (
      <div className="informe-fondo" onKeyDown={(event) => event.key === "Escape" && close()}>
        <div className="informe" role="dialog" aria-modal="true" aria-labelledby="informe-titulo">
          <h2 id="informe-titulo">Informe del economista: {informe.entityName}</h2>
          <p className="informe-autor">{informe.author} · {formatearFecha(informe.publishedAt)}</p>
          {renderSections(informe)}
          <button type="button" onClick={close} autoFocus>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return open(report);
}
