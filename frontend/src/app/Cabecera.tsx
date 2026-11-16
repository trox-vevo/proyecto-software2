import { clearAuthSession } from "../auth/session";
import { alHacerClic, navegar, useRuta } from "./navegacion";
import { useSesion } from "./useSesion";
import "./Cabecera.css";

const PRINCIPALES = [
  ["/", "Inicio"],
  ["/simular/ahorros", "Ahorros"],
  ["/simular/plazo-fijo", "Plazo fijo"],
  ["/planes", "Planes"],
] as const;

export function Cabecera({ onAbrirGlosario }: { onAbrirGlosario: () => void }) {
  const ruta = useRuta();
  const sesion = useSesion();
  const enlace = (destino: string, texto: string) => (
    <a key={destino} href={destino} aria-current={ruta === destino ? "page" : undefined} onClick={alHacerClic(destino)}>
      {texto}
    </a>
  );

  return (
    <header className="cabecera">
      <a className="cabecera-logo" href="/" onClick={alHacerClic("/")}>Yupay Finance</a>
      <nav aria-label="Navegación principal">
        {PRINCIPALES.map(([destino, texto]) => enlace(destino, texto))}
        <button type="button" onClick={onAbrirGlosario}>Glosario financiero</button>
      </nav>
      <nav aria-label="Cuenta">
        {sesion ? <>
          <span className="cabecera-plan">Plan: {sesion.plan}</span>
          {enlace("/favoritos", "Mis favoritos")}
          {enlace("/perfil", "Mi perfil")}
          <button type="button" onClick={() => { clearAuthSession(); navegar("/login"); }}>Cerrar sesión</button>
        </> : <>
          {enlace("/login", "Iniciar sesión")}
          {enlace("/registro", "Crear cuenta")}
        </>}
      </nav>
    </header>
  );
}
