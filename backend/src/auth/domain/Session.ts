import type { UserPlan } from "../../registration/domain/User";

export interface Session {
  id: string;
  userId: number;
  tokenJwt: string;
  expiresAt: string;
  plan: UserPlan;
  planExpiresAt: string | null;
  planCancellationRequested: boolean;
}

export type PublicSession = Omit<Session, "tokenJwt">;
