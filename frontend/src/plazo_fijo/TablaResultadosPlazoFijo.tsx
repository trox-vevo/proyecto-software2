import { obtenerColumnas } from "./columnas";
import type { ModalidadPago, ResultadoPlazoFijo } from "./tipos";
import "../tabla_ahorros/TablaAhorrosView.css";

interface Props {
  resultados: readonly ResultadoPlazoFijo[];
  modalidad: ModalidadPago;
}

export function TablaResultadosPlazoFijo({ resultados, modalidad }: Props) {
  const columnas = obtenerColumnas(modalidad);
  if (resultados.length === 0) return <p role="status">No hay depósitos que mostrar con estos parámetros.</p>;

  return (
    <div className="tabla-contenedor" role="region" aria-label="Resultados de plazo fijo" tabIndex={0}>
      <table className="tabla-ahorros">
        <caption>Depósitos a plazo fijo · {modalidad === "MONTHLY" ? "Pago mensual" : "Pago al final del plazo"}</caption>
        <thead>
          <tr>{columnas.map((columna) => (
            <th key={columna.clave} scope="col" className={columna.numerica ? "num" : undefined}>
              {columna.titulo}
            </th>
          ))}</tr>
        </thead>
        <tbody>{resultados.map((fila) => (
          <tr key={fila.productId}>{columnas.map((columna) => (
            <td key={columna.clave} className={columna.numerica ? "num" : undefined}>
              {columna.presentar(fila)}
            </td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
