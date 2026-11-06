export interface Session {
  id: string;
  userId: string;
  tokenJwt: string;
  expiresAt: string;
}

export type PublicSession = Omit<Session, "tokenJwt">;
