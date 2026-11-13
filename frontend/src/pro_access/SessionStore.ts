import { getStoredSession, saveAuthSession, type UserPlan } from "../auth/session";

// US27: el plan del frontend es solo para la interfaz; la seguridad está en el backend.
// No crea otro almacenamiento: lee y actualiza la sesión que guarda el login (auth/session.ts).
export class SessionStore {
  isPro(): boolean {
    const session = getStoredSession();
    if (session?.plan !== "PRO") return false;
    return session.planExpiresAt == null || Date.parse(session.planExpiresAt) > Date.now();
  }

  setPlan(
    plan: UserPlan,
    details?: { planExpiresAt: string | null; planCancellationRequested: boolean },
  ): void {
    const session = getStoredSession();
    if (!session) return;
    saveAuthSession({
      ...session,
      plan,
      ...(details ?? (plan === "BASICO"
        ? { planExpiresAt: null, planCancellationRequested: false }
        : {})),
    });
  }

  scheduleCancellation(planExpiresAt: string): void {
    this.setPlan("PRO", { planExpiresAt, planCancellationRequested: true });
  }
}

export const sessionStore = new SessionStore();
