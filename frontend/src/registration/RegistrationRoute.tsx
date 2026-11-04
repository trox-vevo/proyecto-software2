import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { RegistrationForm } from "./RegistrationForm";

// No requiere una librería de rutas. /login es el punto de integración con US03.
export function RegistrationRoute({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);
  const [registered, setRegistered] = useState(false);
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(next: string) {
    window.history.pushState(null, "", next);
    setPath(next);
  }

  if (path === "/registro") return (
    <main className="pagina">
      <h1>Yupay Finance</h1>
      <RegistrationForm onRegistered={() => { setRegistered(true); navigate("/login"); }} />
      <a href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>Volver al inicio</a>
    </main>
  );
  if (path === "/login") return (
    <main className="pagina">
      <h1>Inicio de sesión</h1>
      {registered && <p role="status">Cuenta creada correctamente.</p>}
      <p>El inicio de sesión estará disponible cuando se integre esta funcionalidad.</p>
      <a href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }}>Volver al inicio</a>
    </main>
  );
  return <><nav aria-label="Cuenta"><a href="/registro" onClick={(event) => { event.preventDefault(); navigate("/registro"); }}>Crear cuenta</a></nav>{children}</>;
}
