  import { Fragment } from "react";
  import type { ColumnaTabla, CriterioOrden, EstadoTabla } from "./tipos";
  import type { FilaConRiesgo } from "../semaforo/tipos";
  import { SemaforoRiesgo } from "../semaforo/SemaforoRiesgo";
  import { PanelDescripcionRiesgo } from "../semaforo/PanelDescripcionRiesgo";
  import { useSemaforoPanel } from "../semaforo/useSemaforoPanel";
import "./TablaAhorrosView.css";

interface Props {
  columnas: ColumnaTabla[];
  filas: FilaConRiesgo[];
  estado: EstadoTabla;
  mensajeError?: string;
  criterioActivo: CriterioOrden;
  onOrdenar: (columna: ColumnaTabla) => void;
  onReintentar: () => void;
}

/** Solo dibuja: según el estado muestra un mensaje o la tabla. No sabe de dónde vienen los datos. */
export function TablaAhorrosView({
  columnas,
  filas,
  estado,
  mensajeError,
  criterioActivo,
  onOrdenar,
  onReintentar,
}: Props) {
    const { filaAbiertaId, alternar } = useSemaforoPanel();
  if (estado === "CARGANDO") {
    return (
      <p className="tabla-mensaje" role="status">
        Cargando resultados…
      </p>
    );
  }

  if (estado === "ERROR") {
    return (
      <div className="tabla-mensaje" role="alert">
        <p>{mensajeError ?? "Ocurrió un error"}</p>
        <button type="button" onClick={onReintentar}>
          Reintentar
        </button>
      </div>
    );
  }

  if (estado === "VACIO") {
    return <p className="tabla-mensaje">No hay cuentas que mostrar.</p>;
  }

  return (
    <div className="tabla-contenedor">
      <table className="tabla-ahorros">
        <thead>
          <tr>
            {columnas.map((columna) => {
              const activa = columna.ordenable && columna.criterio === criterioActivo;
              return (
                <th
                  key={columna.clave}
                  scope="col"
                  className={columna.numerica ? "num" : undefined}
                  aria-sort={activa ? "descending" : undefined}
                >
                  {columna.ordenable ? (
                    <button type="button" onClick={() => onOrdenar(columna)}>
                      {columna.titulo}
                      {activa ? " ▼" : ""}
                    </button>
                  ) : (
                    columna.titulo
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const abierta = filaAbiertaId === fila.cuentaId;
            const panelId = `panel-riesgo-${fila.cuentaId}`;
            return (
              <Fragment key={fila.cuentaId}>
                <tr>
                  {columnas.map((columna) => (
                    <td key={columna.clave} className={columna.numerica ? "num" : undefined}>
                      {columna.clave === "riesgo" ? (
                        <SemaforoRiesgo
                          riesgo={fila.riesgo}
                          expandido={abierta}
                          panelId={panelId}
                          onToggle={() => alternar(fila.cuentaId)}
                        />
                      ) : (
                        fila[columna.clave]
                      )}
                    </td>
                  ))}
                </tr>
                {abierta && (
                  <tr className="fila-panel-riesgo">
                    <td colSpan={columnas.length}>
                      <PanelDescripcionRiesgo id={panelId} riesgo={fila.riesgo} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
