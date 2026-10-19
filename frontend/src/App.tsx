
import { useCallback, useState } from "react";
import { GlosarioFinanciero } from "./glosario/GlosarioFinanciero";
import { PanelBloqueos } from "./monitor/PanelBloqueos";
import { useMonitorBloqueos } from "./monitor/useMonitorBloqueos";
import { COLUMNAS } from "./tabla_ahorros/columnas";
import { TablaAhorrosView } from "./tabla_ahorros/TablaAhorrosView";
import { useTablaAhorrosController } from "./tabla_ahorros/useTablaAhorrosController";
import "./App.css";

export default function App() {
  const tabla = useTablaAhorrosController();
  const monitor = useMonitorBloqueos(tabla.vista);

  const [glosarioAbierto, setGlosarioAbierto] = useState(false);
  const [terminoSeleccionado, setTerminoSeleccionado] =
    useState<string | null>(null);

  const abrirGlosario = useCallback((termino: string | null = null) => {
    setTerminoSeleccionado(termino);
    setGlosarioAbierto(true);
  }, []);

  const cerrarGlosario = useCallback(() => {
    setGlosarioAbierto(false);
    setTerminoSeleccionado(null);
  }, []);

  return (
    <main className="pagina">
      <h1>Cuentas de ahorro</h1>

      <nav className="glosario-enlaces" aria-label="Ayuda financiera">
        <button
          type="button"
          className="glosario-enlace"
          onClick={() => abrirGlosario()}
        >
          Glosario financiero
        </button>

        <span>Consulta:</span>

        {["TEA", "TREA", "FSD", "Rentabilidad"].map((termino) => (
          <button
            key={termino}
            type="button"
            className="glosario-enlace"
            onClick={() => abrirGlosario(termino)}
          >
            {termino}
          </button>
        ))}
      </nav>

      <TablaAhorrosView
        columnas={COLUMNAS}
        filas={tabla.filas}
        estado={tabla.estado}
        mensajeError={tabla.mensajeError}
        criterioActivo={tabla.criterioActivo}
        onOrdenar={tabla.onOrdenar}
        onReintentar={tabla.reintentar}
      />

      <PanelBloqueos
        eventos={monitor.eventos}
        umbralMs={monitor.umbralMs}
      />

      <GlosarioFinanciero
        abierto={glosarioAbierto}
        terminoSeleccionado={terminoSeleccionado}
        onCerrar={cerrarGlosario}
      />
    </main>
  );
}
