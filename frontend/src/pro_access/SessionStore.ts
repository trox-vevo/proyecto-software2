import { getStoredSession, saveAuthSession, type UserPlan } from "../auth/session";

// US27: el plan del frontend es solo para la interfaz; la seguridad está en el backend.
// No crea otro almacenamiento: lee y actualiza la sesión que guarda el login (auth/session.ts).
export class SessionStore {
  isPro(): boolean {
    return getStoredSession()?.plan === "PRO"; // sin sesión = no Pro
  }

  setPlan(plan: UserPlan): void {
    const session = getStoredSession();
    if (session) saveAuthSession({ ...session, plan });
  }
}

export const sessionStore = new SessionStore();
