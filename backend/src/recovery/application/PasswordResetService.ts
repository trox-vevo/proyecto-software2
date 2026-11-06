import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import type { RecoveryTokenRepository } from "../domain/RecoveryTokenRepository";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

export class InvalidRecoveryTokenError extends Error {
  constructor() {
    super("El enlace de recuperación es inválido o ha expirado.");
    this.name = "InvalidRecoveryTokenError";
  }
}

export class InvalidNewPasswordError extends Error {
  constructor() {
    super("La contraseña debe tener entre 8 y 1024 caracteres.");
    this.name = "InvalidNewPasswordError";
  }
}

export class PasswordResetService {
  constructor(private readonly tokens: RecoveryTokenRepository) {}

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8 || newPassword.length > 1024) {
      throw new InvalidNewPasswordError();
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (!this.tokens.hasValidRecoveryToken(tokenHash, new Date().toISOString())) {
      throw new InvalidRecoveryTokenError();
    }

    const salt = randomBytes(16);
    const derived = await scrypt(newPassword, salt, 64);
    const passwordHash = `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
    const updated = this.tokens.updatePasswordWithRecoveryToken(
      tokenHash,
      passwordHash,
      new Date().toISOString(),
    );
    if (!updated) throw new InvalidRecoveryTokenError();
  }
}
