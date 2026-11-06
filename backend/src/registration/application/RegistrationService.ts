import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import type { User, PublicUser } from "../domain/User";
import { DuplicateEmailError, type UserRepository } from "../domain/UserRepository";

const scrypt = promisify(scryptCallback);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InvalidRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRegistrationError";
  }
}

export interface RegistrationInput {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}

export class RegistrationService {
  constructor(private readonly repository: UserRepository) {}

  private validateEmail(raw: unknown): string {
    if (typeof raw !== "string" || !raw.trim()) {
      throw new InvalidRegistrationError("El correo electronico es obligatorio");
    }
    const email = raw.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      throw new InvalidRegistrationError("Por favor, ingresa un formato de correo valido");
    }
    return email;
  }

  isEmailAvailable(rawEmail: unknown): boolean {
    const email = this.validateEmail(rawEmail);
    return this.repository.findByEmail(email) === null;
  }

  async register(input: RegistrationInput): Promise<PublicUser> {
    if (typeof input.username !== "string" || !input.username.trim()) {
      throw new InvalidRegistrationError("El nombre de usuario es obligatorio");
    }
    const username = input.username.trim();
    if (username.length > 80) {
      throw new InvalidRegistrationError("El nombre de usuario es demasiado largo");
    }
    const email = this.validateEmail(input.email);
    if (typeof input.password !== "string" || !input.password) {
      throw new InvalidRegistrationError("La contrasena es obligatoria");
    }
    if (input.password.length < 8) {
      throw new InvalidRegistrationError("La contrasena debe tener al menos 8 caracteres por seguridad");
    }
    if (input.password.length > 1024) {
      throw new InvalidRegistrationError("La contrasena es demasiado larga");
    }
    if (this.repository.findByEmail(email)) {
      throw new DuplicateEmailError();
    }

    // US01: no guardar la contrasena en texto plano; scrypt utiliza salt aleatorio.
    const salt = randomBytes(16);
    const key = (await scrypt(input.password, salt, 64)) as Buffer;
    const passwordHash = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
    const user: User = {
      id: randomUUID(),
      username,
      email,
      passwordHash,
      plan: "BASICO",
      createdAt: new Date().toISOString(),
    };

    // US02: el UNIQUE de SQLite es la defensa final contra peticiones simultaneas.
    const saved = this.repository.create(user);
    const { passwordHash: _passwordHash, ...publicUser } = saved;
    return publicUser;
  }
}
