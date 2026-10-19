import { useState } from "react";
import { FormularioInversion } from "./inversiones/FormularioInversion";
import type { TipoInstrumento } from "./inversiones/FormularioInversion";
import { PanelBloqueos } from "./monitor/PanelBloqueos";
import { useMonitorBloqueos } from "./monitor/useMonitorBloqueos";
import { COLUMNAS } from "./tabla_ahorros/columnas";
import { TablaAhorrosView } from "./tabla_ahorros/TablaAhorrosView";
import { useTablaAhorrosController } from "./tabla_ahorros/useTablaAhorrosController";
import "./App.css";

export default function App() {
  const [tipoInstrumento, setTipoInstrumento] =
    useState<TipoInstrumento>("AHORROS");
  const tabla = useTablaAhorrosController();
  const monitor = useMonitorBloqueos(tabla.vista);

  return (
    <main className="pagina">
      <h1>Yupay Finance</h1>
      <FormularioInversion
        tipoInstrumento={tipoInstrumento}
        onTipoInstrumentoChange={setTipoInstrumento}
      />
      {tipoInstrumento === "AHORROS" && (
        <section aria-labelledby="titulo-resultados-ahorros">
          <h2 id="titulo-resultados-ahorros">Cuentas de ahorro disponibles</h2>
          <TablaAhorrosView
            columnas={COLUMNAS}
            filas={tabla.filas}
            estado={tabla.estado}
            mensajeError={tabla.mensajeError}
            criterioActivo={tabla.criterioActivo}
            onOrdenar={tabla.onOrdenar}
            onReintentar={tabla.reintentar}
          />
        </section>
      )}
      <PanelBloqueos eventos={monitor.eventos} umbralMs={monitor.umbralMs} />
    </main>
  );
}
