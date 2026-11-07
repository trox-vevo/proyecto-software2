// US01: usuario registrado con plan basico.
export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash: string;
  plan: "BASICO";
  createdAt: string;
}

export type PublicUser = Omit<User, "passwordHash">;

// El alta todavía no tiene identidad. SQLite la asigna al persistirla.
export type NewUser = Omit<User, "id">;
