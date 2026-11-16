import { ContadorPendientes } from "./ContadorPendientes";
import { NotificacionVisual } from "./NotificacionVisual";
import { PanelDetalleAlerta } from "./PanelDetalleAlerta";
import { useAlertas } from "./useAlertas";
import "./alertas.css";

/** Sección de alertas: contador, lista y, al elegir una, su detalle en un panel lateral. */
export function AlertasSeccion() {
  const { alertas, pendientes, cargando, error, seleccionada, abrirDetalle, cerrarDetalle, panelMostrado } = useAlertas();

  return (
    <section className="alertas" aria-labelledby="alertas-titulo">
      <div className="alertas-cabecera">
        <h2 id="alertas-titulo">Alertas</h2>
        {!cargando && !error && <ContadorPendientes pendientes={pendientes} />}
      </div>

      {cargando ? (
        <p>Cargando alertas…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : alertas.length === 0 ? (
        <p>No tienes alertas.</p>
      ) : (
        <div className={seleccionada ? "alertas-cuerpo alertas-cuerpo-con-panel" : "alertas-cuerpo"}>
          <ul className="alertas-lista">
            {alertas.map((alerta) => (
              <NotificacionVisual
                key={alerta.id}
                alerta={alerta}
                seleccionada={seleccionada?.id === alerta.id}
                onAbrir={abrirDetalle}
              />
            ))}
          </ul>
          {seleccionada && (
            <PanelDetalleAlerta
              key={seleccionada.id}
              alerta={seleccionada}
              onMostrado={panelMostrado}
              onCerrar={cerrarDetalle}
            />
          )}
        </div>
      )}
    </section>
  );
}
