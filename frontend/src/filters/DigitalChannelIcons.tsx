import type { DigitalChannelsDto } from "./resultFilters";
import "./DigitalChannelIcons.css";

interface Props {
  channels: DigitalChannelsDto;
}

// Dibujos simples en SVG, sin dependencias: una computadora y un celular
const ICONO_BANCA = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <line x1="8" y1="20" x2="16" y2="20" />
    <line x1="12" y1="16" x2="12" y2="20" />
  </svg>
);
const ICONO_APP = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="7" y="2" width="10" height="20" rx="2" />
    <line x1="11" y1="18" x2="13" y2="18" />
  </svg>
);

const siNo = (valor: boolean) => (valor ? "sí" : "no");

/** US19 (TS-57): en cada fila, un ícono por canal digital. En gris si la entidad no lo tiene. */
export function DigitalChannelIcons({ channels }: Props) {
  // Texto que leen los lectores de pantalla, porque los íconos solos no se entienden
  function getAccessibleLabel() {
    return `Banca digital: ${siNo(channels.hasDigitalBanking)}. App móvil: ${siNo(channels.hasMobileApp)}.`;
  }

  function renderIcons() {
    return (
      <span className="canales-digitales" role="img" aria-label={getAccessibleLabel()}>
        <span
          className={channels.hasDigitalBanking ? "canal canal-si" : "canal canal-no"}
          title={`Banca digital: ${siNo(channels.hasDigitalBanking)}`}
          aria-hidden="true"
        >
          {ICONO_BANCA}
        </span>
        <span
          className={channels.hasMobileApp ? "canal canal-si" : "canal canal-no"}
          title={`App móvil: ${siNo(channels.hasMobileApp)}`}
          aria-hidden="true"
        >
          {ICONO_APP}
        </span>
      </span>
    );
  }

  return renderIcons();
}
