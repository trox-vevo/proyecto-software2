import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { LoginView, type AuthSession } from "../auth/LoginView";
import { RegistrationForm } from "./RegistrationForm";

export function RegistrationRoute({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);
  const [registered, setRegistered] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(next: string) {
    window.history.pushState(null, "", next);
    setPath(next);
  }

  function navigateLink(event: MouseEvent<HTMLAnchorElement>, next: string) {
    event.preventDefault();
    navigate(next);
  }

  if (path === "/registro") {
    return (
      <main className="pagina">
        <h1>Yupay Finance</h1>
        <RegistrationForm
          onRegistered={() => {
            setRegistered(true);
            navigate("/login");
          }}
        />
        <a href="/" onClick={(event) => navigateLink(event, "/")}>
          Volver al inicio
        </a>
        {" · "}
        <a href="/registro" onClick={(event) => navigateLink(event, "/registro")}>
          Crear cuenta
        </a>
      </main>
    );
  }

  if (path === "/login") {
    return (
      <>
        {registered && <p role="status">Cuenta creada correctamente.</p>}
        <LoginView
          onLogin={(nextSession) => {
            setSession(nextSession);
            navigate("/");
          }}
        />
        <a href="/" onClick={(event) => navigateLink(event, "/")}>
          Volver al inicio
        </a>
        <p className="sesion-estado" aria-live="polite">
          {session ? "Sesión iniciada." : ""}
        </p>
      </>
    );
  }

  return (
    <>
      <nav aria-label="Cuenta">
        <a href="/registro" onClick={(event) => navigateLink(event, "/registro")}>
          Crear cuenta
        </a>
        {" · "}
        <a href="/login" onClick={(event) => navigateLink(event, "/login")}>
          Iniciar sesión
        </a>
        {session && (
          <button
            type="button"
            onClick={() => {
              setSession(null);
              navigate("/login");
            }}
          >
            Cerrar sesión
          </button>
        )}
      </nav>
      {children}
    </>
  );
}
