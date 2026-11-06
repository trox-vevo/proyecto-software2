import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { scrypt as scryptCallback } from "node:crypto";
import jwt from "jsonwebtoken";
import type { User } from "../../registration/domain/User";
import type { UserRepository } from "../../registration/domain/UserRepository";
import type { Session } from "../domain/Session";
import { InMemorySessionRepository } from "../infrastructure/InMemorySessionRepository";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Credenciales inválidas");
    this.name = "InvalidCredentialsError";
  }
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository = new InMemorySessionRepository(),
  ) {}

  private parseScryptHash(hash: string): { saltHex: string; keyHex: string } | null {
    if (!hash.startsWith("scrypt$")) return null;
    const parts = hash.split("$");
    if (parts.length !== 3) return null;
    return { saltHex: parts[1], keyHex: parts[2] };
  }

  private async verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
    const parsed = this.parseScryptHash(passwordHash);
    if (!parsed) return false;
    const salt = Buffer.from(parsed.saltHex, "hex");
    const derived = (await scrypt(plain, salt, 64)) as Buffer;
    return derived.toString("hex") === parsed.keyHex;
  }

  async login(email: string, password: string): Promise<Session> {
    const user = this.userRepository.findByEmail(email.toLowerCase());
    if (!user) throw new InvalidCredentialsError();

    const ok = await this.verifyPassword(password, user.passwordHash);
    if (!ok) throw new InvalidCredentialsError();

    const secret = process.env.JWT_SECRET ?? "dev-secret";
    const expiresInSec = 7 * 24 * 3600; // 7 days
    const token = jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: expiresInSec });

    const session: Session = {
      id: randomUUID(),
      userId: user.id,
      tokenJwt: token,
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    };

    this.sessionRepository.create(session);
    return session;
  }

  findSessionByToken(token: string): Session | null {
    return this.sessionRepository.findByToken(token);
  }
}
