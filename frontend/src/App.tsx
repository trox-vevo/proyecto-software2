import { PanelBloqueos } from "./monitor/PanelBloqueos";
import { useMonitorBloqueos } from "./monitor/useMonitorBloqueos";
import { COLUMNAS } from "./tabla_ahorros/columnas";
import { TablaAhorrosView } from "./tabla_ahorros/TablaAhorrosView";
import { useTablaAhorrosController } from "./tabla_ahorros/useTablaAhorrosController";
import "./App.css";

export default function App() {
  const tabla = useTablaAhorrosController();
  const monitor = useMonitorBloqueos(tabla.vista);

  return (
    <main className="pagina">
      <h1>Cuentas de ahorro</h1>
      <TablaAhorrosView
        columnas={COLUMNAS}
        filas={tabla.filas}
        estado={tabla.estado}
        mensajeError={tabla.mensajeError}
        criterioActivo={tabla.criterioActivo}
        onOrdenar={tabla.onOrdenar}
        onReintentar={tabla.reintentar}
      />
      <PanelBloqueos eventos={monitor.eventos} umbralMs={monitor.umbralMs} />
    </main>
  );
}
