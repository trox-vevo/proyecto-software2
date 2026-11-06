import { PanelBloqueos } from "./monitor/PanelBloqueos";
import { useMonitorBloqueos } from "./monitor/useMonitorBloqueos";
import { COLUMNAS } from "./tabla_ahorros/columnas";
import { TablaAhorrosView } from "./tabla_ahorros/TablaAhorrosView";
import { useTablaAhorrosController } from "./tabla_ahorros/useTablaAhorrosController";
import { LoginView, type AuthSession } from "./auth/LoginView";
import { useState } from "react";
import "./App.css";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);

  if (session === null) {
    return <LoginView onLogin={setSession} />;
  }

  return <Dashboard onLogout={() => setSession(null)} />;
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const tabla = useTablaAhorrosController();
  const monitor = useMonitorBloqueos(tabla.vista);

  return (
    <main className="pagina">
      <header className="pagina-encabezado">
        <h1>Cuentas de ahorro</h1>
        <button className="boton-cerrar-sesion" type="button" onClick={onLogout}>
          Cerrar sesión
        </button>
      </header>
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
