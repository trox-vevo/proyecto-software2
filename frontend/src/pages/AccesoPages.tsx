import { useState, type ReactNode } from "react";
import { ForgotPasswordView } from "../auth/ForgotPasswordView";
import { LoginView } from "../auth/LoginView";
import { ResetPasswordView } from "../auth/ResetPasswordView";
import { saveAuthSession } from "../auth/session";
import { RegistrationForm } from "../registration/RegistrationForm";
import { alHacerClic, navegar, useRuta } from "../app/navegacion";
import "../app/Cabecera.css";

function Enlace({ a, children }: { a: string; children: ReactNode }) {
  return <a className="login-enlace-recuperacion" href={a} onClick={alHacerClic(a)}>{children}</a>;
}

/** Pantallas de acceso (US01–US03, US14, US15): sin cabecera completa, solo el logo que lleva a Inicio. */
function PantallaAcceso({ children }: { children: ReactNode }) {
  return <>
    <header className="cabecera-acceso">
      <a className="cabecera-logo" href="/" onClick={alHacerClic("/")}>Yupay Finance</a>
    </header>
    {children}
  </>;
}

/**
 * Si la ruta es de acceso, muestra esa pantalla; si no, muestra `children` (el resto de la app).
 * El aviso ("Cuenta creada correctamente.") vive aquí porque pasa de una pantalla a otra; se borra al salir de /login.
 */
export function RutasAcceso({ children }: { children: ReactNode }) {
  const ruta = useRuta();
  const [aviso, setAviso] = useState("");
  if (aviso && ruta !== "/login") setAviso("");

  function irAlLogin(mensaje: string) {
    setAviso(mensaje);
    navegar("/login");
  }

  const volver = <Enlace a="/">Volver al inicio</Enlace>;
  switch (ruta) {
    case "/registro":
      return <PantallaAcceso>
        <RegistrationForm onRegistered={() => irAlLogin("Cuenta creada correctamente.")}>{volver}</RegistrationForm>
      </PantallaAcceso>;
    case "/login":
      return <PantallaAcceso>
        <LoginView
          aviso={aviso}
          onLogin={(sesion) => { saveAuthSession(sesion); navegar("/"); }}
          onForgotPassword={() => navegar("/recuperar-contrasena")}
        >{volver}</LoginView>
      </PantallaAcceso>;
    case "/recuperar-contrasena":
      return <PantallaAcceso>
        <ForgotPasswordView><Enlace a="/login">Volver a iniciar sesión</Enlace></ForgotPasswordView>
      </PantallaAcceso>;
    case "/restablecer-contrasena":
      return <PantallaAcceso>
        <ResetPasswordView
          token={new URLSearchParams(window.location.search).get("token")}
          onReset={() => irAlLogin("Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.")}
        ><Enlace a="/login">Volver a iniciar sesión</Enlace></ResetPasswordView>
      </PantallaAcceso>;
    default:
      return children;
  }
}
