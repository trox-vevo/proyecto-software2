// US01: usuario registrado con plan basico.
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  plan: "BASICO";
  createdAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;
