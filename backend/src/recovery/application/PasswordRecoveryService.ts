import { createHash, randomBytes } from "node:crypto";
import type { UserRepository } from "../../registration/domain/UserRepository";
import type { RecoveryTokenRepository } from "../domain/RecoveryTokenRepository";

const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

export interface RecoveryEmailService {
  sendRecoveryLink(destination: string, link: string): Promise<boolean>;
}

export class RecoveryEmailDeliveryError extends Error {
  constructor(cause?: unknown) {
    super("No se pudo enviar el correo de recuperación", { cause });
    this.name = "RecoveryEmailDeliveryError";
  }
}

export class PasswordRecoveryService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: RecoveryTokenRepository,
    private readonly emailService: RecoveryEmailService,
    private readonly frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173",
  ) {}

  async requestRecovery(email: string): Promise<void> {
    const user = this.users.findByEmail(email.trim().toLowerCase());
    if (!user) return;

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS).toISOString();
    const tokenId = this.tokens.createRecoveryToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const link = new URL("/restablecer-contrasena", this.frontendUrl);
    link.searchParams.set("token", rawToken);

    try {
      const sent = await this.emailService.sendRecoveryLink(user.email, link.toString());
      if (!sent) throw new RecoveryEmailDeliveryError();
      this.tokens.invalidateRecoveryTokens(user.id, tokenId);
    } catch (error: unknown) {
      this.tokens.deleteRecoveryToken(tokenId);
      if (error instanceof RecoveryEmailDeliveryError) throw error;
      throw new RecoveryEmailDeliveryError(error);
    }
  }
}
