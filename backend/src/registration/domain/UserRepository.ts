import type { NewUser, User } from "./User";

export type { NewUser } from "./User";

export interface UserRepository {
  findByEmail(email: string): User | null;
  create(user: NewUser): User;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("El correo ingresado ya se encuentra en uso");
    this.name = "DuplicateEmailError";
  }
}
