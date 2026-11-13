import type { NewUser, User } from "./User";

export type { NewUser } from "./User";

export interface UserRepository {
  findByEmail(email: string): User | null;
  findById(id: number): User | null;
  create(user: NewUser): User;
  // US33 (TS-101): plan PRO y vencimiento en una sola escritura atómica.
  activatePro(id: number, expiresAt: string): void;
  requestProCancellation(id: number): void;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("El correo ingresado ya se encuentra en uso");
    this.name = "DuplicateEmailError";
  }
}
