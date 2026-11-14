import { useState } from "react";
import { obtenerColumnas } from "./columnas";
import type { ModalidadPago, ResultadoPlazoFijo } from "./tipos";
import { EmptyStateComponent } from "../tabla_ahorros/EmptyStateComponent";
import { RiskBadge } from "../pro_access/RiskBadge";
import { EconomistReportModal } from "../risk/EconomistReportModal";
import type { EconomistReport } from "../risk/tipos";
import "../tabla_ahorros/TablaAhorrosView.css";

interface Props {
  resultados: readonly ResultadoPlazoFijo[];
  modalidad: ModalidadPago;
  onViewPlans?: () => void; // US27: App pasa () => navigate("/planes")
}

const sinAccion = () => {};

export function TablaResultadosPlazoFijo({ resultados, modalidad, onViewPlans = sinAccion }: Props) {
  const columnas = obtenerColumnas(modalidad);
  // US26: informe que se muestra en la ventana; null cuando está cerrada
  const [reporteAbierto, setReporteAbierto] = useState<EconomistReport | null>(null);
  // US13: si no hay bancos para esta búsqueda, mostramos la pantalla de "Sin resultados".
  if (resultados.length === 0) {
    return (
      <EmptyStateComponent
        titulo="Sin resultados"
        mensaje="No encontramos opciones para esta configuración. Intenta cambiar a otros parámetros"
        icono="busqueda"
      />
    );
  }

  return (
    <>
      <div className="tabla-contenedor" role="region" aria-label="Resultados de plazo fijo" tabIndex={0}>
        <table className="tabla-ahorros">
          <caption>Depósitos a plazo fijo · {modalidad === "MONTHLY" ? "Pago mensual" : "Pago al final del plazo"}</caption>
          <thead>
            <tr>{columnas.map((columna) => (
              <th key={columna.clave} scope="col" className={columna.numerica ? "num" : undefined}>
                {columna.titulo}
              </th>
            ))}<th scope="col">Calificación</th></tr>
          </thead>
          <tbody>{resultados.map((fila) => (
            <tr key={fila.productId}>{columnas.map((columna) => (
              <td key={columna.clave} className={columna.numerica ? "num" : undefined}>
                {columna.presentar(fila)}
              </td>
            ))}
              {/* US27: el productId es también el id de la entidad (US25). US26: al cargar el informe se abre la ventana */}
              <td>
                <RiskBadge
                  entityId={fila.productId}
                  riskRating={fila.riskRating}
                  onViewPlans={onViewPlans}
                  onReportLoaded={(report) => setReporteAbierto(report as EconomistReport)}
                />
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <EconomistReportModal report={reporteAbierto} onClose={() => setReporteAbierto(null)} />
    </>
  );
}
