// US01: usuario registrado con plan basico.
export type UserPlan = "BASICO" | "PRO";

export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  plan: UserPlan;
  createdAt: string;
  // US33: fin del periodo Pro pagado (ISO). null si nunca pagó.
  planExpiresAt: string | null;
  planCancellationRequested?: boolean;
}

export type PublicUser = Omit<User, "passwordHash" | "planExpiresAt" | "planCancellationRequested">;

// El alta todavía no tiene identidad. SQLite la asigna al persistirla.
export type NewUser = Omit<User, "id" | "planExpiresAt" | "planCancellationRequested">;

// US27: regla de negocio del plan
export function hasProAccess(user: User, now: Date = new Date()): boolean {
  if (user.plan !== "PRO") return false;
  if (user.planExpiresAt == null) return true;
  const expiresAt = Date.parse(user.planExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}
