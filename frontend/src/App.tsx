import { useState } from "react";
import { PanelBloqueos } from "./monitor/PanelBloqueos";
import { PlazoFijoView } from "./plazo_fijo/PlazoFijoView";
import { useMonitorBloqueos } from "./monitor/useMonitorBloqueos";
import { COLUMNAS } from "./tabla_ahorros/columnas";
import { TablaAhorrosView } from "./tabla_ahorros/TablaAhorrosView";
import { useTablaAhorrosController } from "./tabla_ahorros/useTablaAhorrosController";
import "./App.css";

export default function App() {
  const [instrumento, setInstrumento] = useState<"ahorros" | "plazo-fijo">("ahorros");
  const tabla = useTablaAhorrosController();
  const monitor = useMonitorBloqueos(tabla.vista);

  return (
    <main className="pagina">
      <h1>Yupay Finance</h1>
      <nav className="instrumentos" aria-label="Instrumento financiero">
        <button type="button" aria-pressed={instrumento === "ahorros"}
          onClick={() => setInstrumento("ahorros")}>Cuentas de ahorro</button>
        <button type="button" aria-pressed={instrumento === "plazo-fijo"}
          onClick={() => setInstrumento("plazo-fijo")}>Depósito a Plazo Fijo</button>
      </nav>
      <section hidden={instrumento !== "ahorros"} aria-labelledby="titulo-ahorros">
        <h2 id="titulo-ahorros">Cuentas de ahorro</h2>
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
      </section>
      <div hidden={instrumento !== "plazo-fijo"}>
        <PlazoFijoView />
      </div>
    </main>
  );
}
