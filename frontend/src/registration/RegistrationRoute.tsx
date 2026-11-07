import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { LoginView, type AuthSession } from "../auth/LoginView";
import { ForgotPasswordView } from "../auth/ForgotPasswordView";
import { ResetPasswordView } from "../auth/ResetPasswordView";
import { clearAuthSession, getStoredSession, saveAuthSession } from "../auth/session";
import { RegistrationForm } from "./RegistrationForm";

export function RegistrationRoute({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(window.location.pathname);
  const [registered, setRegistered] = useState(false);
  const [loginNotice, setLoginNotice] = useState("");
  const [session, setSession] = useState<AuthSession | null>(getStoredSession);
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
        {loginNotice && <p role="status">{loginNotice}</p>}
        <LoginView
          onLogin={(nextSession) => {
            saveAuthSession(nextSession);
            setSession(nextSession);
            navigate("/");
          }}
          onForgotPassword={() => navigate("/recuperar-contrasena")}
        />
        <a href="/" onClick={(event) => navigateLink(event, "/")}>
          Volver al inicio
        </a>
        <p className="sesion-estado" aria-live="polite">
          {session ? `Sesión iniciada. Plan: ${session.plan}.` : ""}
        </p>
      </>
    );
  }

  if (path === "/recuperar-contrasena") {
    return (
      <>
        <ForgotPasswordView />
        <a href="/login" onClick={(event) => navigateLink(event, "/login")}>
          Volver a iniciar sesión
        </a>
      </>
    );
  }

  if (path === "/restablecer-contrasena") {
    return (
      <>
        <ResetPasswordView
          token={new URLSearchParams(window.location.search).get("token")}
          onReset={() => {
            setLoginNotice("Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.");
            navigate("/login");
          }}
        />
        <a href="/login" onClick={(event) => navigateLink(event, "/login")}>
          Volver a iniciar sesión
        </a>
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
          <>
            <span>Plan: {session.plan}</span>
            <button
              type="button"
              onClick={() => {
                clearAuthSession();
                setSession(null);
                navigate("/login");
              }}
            >
              Cerrar sesión
            </button>
          </>
        )}
      </nav>
      {children}
    </>
  );
}
