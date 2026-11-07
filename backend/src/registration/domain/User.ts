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
