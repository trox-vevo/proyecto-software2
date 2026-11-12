import "./ProAccess.css";

const proBenefits: string[] = [
  "Calificación de riesgo oficial de cada entidad",
  "Informe del economista con el análisis de solidez",
  "Reporte de solvencia descargable en PDF",
  "Simulaciones favoritas y alertas del mercado",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onViewPlans: () => void;
}

// US27 · Escenario 2: ventana de ventas con los beneficios del Plan Pro.
export function PaywallModal({ open, onClose, onViewPlans }: Props) {
  if (!open) return null;

  function goToPlans(): void {
    onClose();
    onViewPlans(); // App pasa () => navigate("/planes"), igual que FavoriteButton (US28)
  }

  return (
    <div className="paywall-fondo" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <div className="paywall" role="dialog" aria-modal="true" aria-labelledby="paywall-titulo">
        <h2 id="paywall-titulo">Desbloquea el Plan Pro</h2>
        <ul>
          {proBenefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
        <button type="button" className="paywall-suscribirse" onClick={goToPlans} autoFocus>
          Suscribirme al Plan Pro
        </button>
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
