import type { ColumnaTabla, CriterioOrden, EstadoTabla, FilaAhorro } from "./tipos";
import { EmptyStateComponent } from "./EmptyStateComponent";
import "./TablaAhorrosView.css";

interface Props {
  columnas: ColumnaTabla[];
  filas: FilaAhorro[];
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
          {filas.map((fila) => (
            <tr key={fila.cuentaId}>
              {columnas.map((columna) => (
                <td key={columna.clave} className={columna.numerica ? "num" : undefined}>
                  {fila[columna.clave]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
