import { createHash, randomUUID, scryptSync } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";

const directory = mkdtempSync(join(tmpdir(), "yupay-recovery-"));
const databasePath = join(directory, "users.sqlite");
const repository = new SqliteUserRepository(databasePath);
const salt = Buffer.from("1234567890123456");
const passwordHash = `scrypt$${salt.toString("hex")}$${scryptSync("Clave-segura-123", salt, 64).toString("hex")}`;
const userId = randomUUID();
repository.create({
  id: userId,
  username: "Estudiante",
  email: "cuenta@example.com",
  passwordHash,
  plan: "BASICO",
  createdAt: new Date().toISOString(),
});

const emailService = {
  sendRecoveryLink: vi.fn(async () => true),
};
let server: Server;
let endpoint: string;

beforeAll(async () => {
  server = createApp(
    { findFixedDepositsByDepartment: async () => [] },
    repository,
    repository,
    emailService,
  ).listen(0);
  await once(server, "listening");
  endpoint = `http://localhost:${(server.address() as AddressInfo).port}/api/auth/forgot-password`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  repository.close();
  rmSync(directory, { recursive: true, force: true });
});

const post = (body: unknown) =>
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const createRecoveryToken = async () => {
  emailService.sendRecoveryLink.mockClear();
  const response = await post({ email: "cuenta@example.com" });
  expect(response.status).toBe(202);
  const sent = emailService.sendRecoveryLink.mock.calls[0];
  return new URL(sent[1]).searchParams.get("token")!;
};

const reset = (body: unknown) =>
  fetch(`${endpoint.replace("/forgot-password", "/reset-password")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/auth/forgot-password", () => {
  it("creates a hashed expiring token and emails the recovery link", async () => {
    const before = Date.now();
    const response = await post({ email: " CUENTA@example.com " });
    const after = Date.now();

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      message: "Si el correo existe, recibirás un enlace de recuperación.",
    });
    expect(emailService.sendRecoveryLink).toHaveBeenCalledOnce();
    const [destination, link] = emailService.sendRecoveryLink.mock.calls[0];
    expect(destination).toBe("cuenta@example.com");

    const url = new URL(link);
    expect(url.pathname).toBe("/restablecer-contrasena");
    const rawToken = url.searchParams.get("token");
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const database = new DatabaseSync(databasePath);
    try {
      const row = database
        .prepare("SELECT token_hash, expires_at, used FROM password_recovery_tokens")
        .get() as { token_hash: string; expires_at: string; used: number };
      expect(row.token_hash).toBe(createHash("sha256").update(rawToken!).digest("hex"));
      expect(row.token_hash).not.toBe(rawToken);
      expect(row.used).toBe(0);
      const expiry = Date.parse(row.expires_at);
      expect(expiry).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
      expect(expiry).toBeLessThanOrEqual(after + 60 * 60 * 1000);
    } finally {
      database.close();
    }
  });

  it("responds the same for an unknown account without sending email", async () => {
    emailService.sendRecoveryLink.mockClear();
    const response = await post({ email: "no-existe@example.com" });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      message: "Si el correo existe, recibirás un enlace de recuperación.",
    });
    expect(emailService.sendRecoveryLink).not.toHaveBeenCalled();
  });

  it("invalidates earlier tokens only after the new recovery email is sent", async () => {
    const response = await post({ email: "cuenta@example.com" });
    expect(response.status).toBe(202);

    const database = new DatabaseSync(databasePath);
    try {
      const tokens = database
        .prepare("SELECT used FROM password_recovery_tokens ORDER BY id")
        .all() as { used: number }[];
      expect(tokens.map(({ used }) => used)).toEqual([1, 0]);
    } finally {
      database.close();
    }
  });

  it("rejects malformed email input", async () => {
    expect((await post({ email: "no-es-correo" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(emailService.sendRecoveryLink).not.toHaveBeenCalled();
  });

  it("keeps the response generic and removes an undelivered token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    emailService.sendRecoveryLink.mockResolvedValueOnce(false);
    const response = await post({ email: "cuenta@example.com" });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      message: "Si el correo existe, recibirás un enlace de recuperación.",
    });
    expect(log).toHaveBeenCalledOnce();

    const database = new DatabaseSync(databasePath);
    try {
      const active = database
        .prepare("SELECT COUNT(*) AS count FROM password_recovery_tokens WHERE used = 0")
        .get() as { count: number };
      expect(active.count).toBe(1);
    } finally {
      database.close();
      log.mockRestore();
    }
  });

  it("updates the password with a valid token, then rejects reuse", async () => {
    const token = await createRecoveryToken();
    const response = await reset({ token, newPassword: "Nueva-clave-segura-456" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "Contraseña actualizada correctamente.",
    });

    const login = async (password: string) =>
      fetch(endpoint.replace("/forgot-password", "/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "cuenta@example.com", password }),
      });
    expect((await login("Clave-segura-123")).status).toBe(401);
    expect((await login("Nueva-clave-segura-456")).status).toBe(200);

    const reused = await reset({ token, newPassword: "Otra-clave-segura-789" });
    expect(reused.status).toBe(400);
    expect((await reused.json()).message).toContain("inválido o ha expirado");
  });

  it("rejects unknown, expired and malformed recovery tokens", async () => {
    const invalid = await reset({ token: "token-no-valido", newPassword: "Nueva-clave-123" });
    expect(invalid.status).toBe(400);

    repository.createRecoveryToken({
      userId,
      tokenHash: createHash("sha256").update("token-expirado").digest("hex"),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const expired = await reset({ token: "token-expirado", newPassword: "Nueva-clave-123" });
    expect(expired.status).toBe(400);

    expect((await reset({ token: "token-valido" })).status).toBe(400);
  });

  it("enforces the password length before consuming a valid token", async () => {
    const token = await createRecoveryToken();
    const response = await reset({ token, newPassword: "corta" });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("8 y 1024");
    expect((await reset({ token, newPassword: "Nueva-clave-segura-456" })).status).toBe(200);
  });
});
