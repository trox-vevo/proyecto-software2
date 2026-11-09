// US01: usuario registrado con plan basico.
export type UserPlan = "BASICO" | "PRO";

export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  plan: UserPlan;
  createdAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;

// El alta todavía no tiene identidad. SQLite la asigna al persistirla.
export type NewUser = Omit<User, "id">;

// US27: regla de negocio del plan
export function hasProAccess(user: User): boolean {
  return user.plan === "PRO";
}
