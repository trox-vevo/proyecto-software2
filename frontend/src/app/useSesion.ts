import { useEffect, useState } from "react";
import { AUTH_SESSION_CHANGED_EVENT, getStoredSession, type AuthSession } from "../auth/session";

/** Sesión actual. Se actualiza al iniciar o cerrar sesión, al pagar el Pro y desde otra pestaña. */
export function useSesion(): AuthSession | null {
  const [sesion, setSesion] = useState<AuthSession | null>(getStoredSession);
  useEffect(() => {
    const actualizar = () => setSesion(getStoredSession());
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, actualizar);
    window.addEventListener("storage", actualizar);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, actualizar);
      window.removeEventListener("storage", actualizar);
    };
  }, []);
  return sesion;
}
