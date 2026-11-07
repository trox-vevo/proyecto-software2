import { Fragment } from "react";
import type { ColumnaTabla, CriterioOrden, EstadoTabla } from "./tipos";
import type { FilaConRiesgo } from "../semaforo/tipos";
import { SemaforoRiesgo } from "../semaforo/SemaforoRiesgo";
import { PanelDescripcionRiesgo } from "../semaforo/PanelDescripcionRiesgo";
import { useSemaforoPanel } from "../semaforo/useSemaforoPanel";
import { EmptyStateComponent } from "./EmptyStateComponent";
import "./TablaAhorrosView.css";
import { IndicadorFSD } from "../fsd/IndicadorFSD";
import { TERMINO_POR_COLUMNA } from "../glosario/terminos";
import { FavoriteButton } from "../commerce/FavoriteButton";

interface Props {
  columnas: ColumnaTabla[];
  filas: FilaConRiesgo[];
  estado: EstadoTabla;
  mensajeError?: string;
  criterioActivo: CriterioOrden;
  onOrdenar: (columna: ColumnaTabla) => void;
  onReintentar: () => void;
  onConsultarTermino?: (termino: string) => void;
  favoritos?: { days: number; onViewPlans: () => void };
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
  onConsultarTermino,
  favoritos,
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
    return (
      <EmptyStateComponent
        titulo="Sin resultados"
        mensaje="No encontramos opciones para esta configuración. Intenta cambiar a otros parámetros"
        icono="busqueda"
      />
    );
  }

  return (
    <div className="tabla-contenedor">
      <table className="tabla-ahorros">
        <thead>
          <tr>
            {columnas.map((columna) => {
              const activa =
                columna.ordenable && columna.criterio === criterioActivo;
              return (
                <th
                  key={columna.clave}
                  scope="col"
                  aria-label={columna.titulo}
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
                  {onConsultarTermino && TERMINO_POR_COLUMNA[columna.clave] && <button className="glosario-contexto" type="button" aria-label={`Consultar ${TERMINO_POR_COLUMNA[columna.clave]}`} onClick={() => onConsultarTermino(TERMINO_POR_COLUMNA[columna.clave])}>ⓘ</button>}
                </th>
              );
            })}
            {favoritos && <th scope="col">Favoritos Pro</th>}
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
                    <td
                      key={columna.clave}
                      className={columna.numerica ? "num" : undefined}
                    >
                      {columna.clave === "coberturaFSD" ? <IndicadorFSD cobertura={fila.coberturaFSD} /> : columna.clave === "riesgo" ? (
                        <SemaforoRiesgo
                          riesgo={fila.riesgo}
                          expandido={abierta}
                          panelId={panelId}
                          onToggle={() => alternar(fila.cuentaId)}
                        />
                      ) : columna.mostrar ? (
                        columna.mostrar(fila[columna.clave])
                      ) : (
                        fila[columna.clave]
                      )}
                    </td>
                  ))}
                  {favoritos && <td><FavoriteButton accountId={fila.cuentaId} days={favoritos.days} onViewPlans={favoritos.onViewPlans} /></td>}
                </tr>
                {abierta && (
                  <tr className="fila-panel-riesgo">
                    <td colSpan={columnas.length + (favoritos ? 1 : 0)}>
                      <PanelDescripcionRiesgo
                        id={panelId}
                        riesgo={fila.riesgo}
                      />
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
