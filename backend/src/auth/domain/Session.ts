import type { UserPlan } from "../../registration/domain/User";

export interface Session {
  id: string;
  userId: number;
  tokenJwt: string;
  expiresAt: string;
  plan: UserPlan;
}

export type PublicSession = Omit<Session, "tokenJwt">;
