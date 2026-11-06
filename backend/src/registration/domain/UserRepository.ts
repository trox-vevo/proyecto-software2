import type { User } from "./User";

export interface UserRepository {
  findByEmail(email: string): User | null;
  create(user: User): User;
}

export class DuplicateEmailError extends Error {
  constructor() {
    super("El correo ingresado ya se encuentra en uso");
    this.name = "DuplicateEmailError";
  }
}
