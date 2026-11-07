import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scryptSync } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { InvalidRegistrationError, RegistrationService } from "../../src/registration/application/RegistrationService";
import { DuplicateEmailError } from "../../src/registration/domain/UserRepository";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";

const directory = mkdtempSync(join(tmpdir(), "yupay-registration-"));
const file = join(directory, "users.sqlite");
const repository = new SqliteUserRepository(file);
const service = new RegistrationService(repository);
const valid = { username: "Estudiante", email: "nuevo@example.com", password: "Clave-segura-123" };
let server: Server;
let endpoint: string;
beforeAll(async () => {
  server = createApp({ findFixedDepositsByDepartment: async () => [] }, repository).listen(0);
  await once(server, "listening");
  endpoint = `http://localhost:${(server.address() as AddressInfo).port}/api/users`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  repository.close();
  rmSync(directory, { recursive: true, force: true });
});
const post = (body: unknown) => fetch(`${endpoint}/register`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

describe("US01 / US02: registro y persistencia", () => {
  it("normaliza correo y nombre, persiste y guarda solo un hash con salt", async () => {
    const result = await service.register({ ...valid, username: " Estudiante ", email: " NUEVO@EXAMPLE.COM " });
    expect(result).toMatchObject({ username: "Estudiante", email: valid.email, plan: "BASICO" });
    expect(typeof result.id).toBe("number");
    expect(result).not.toHaveProperty("passwordHash");
    const secondConnection = new SqliteUserRepository(file);
    try {
      const saved = secondConnection.findByEmail(valid.email)!;
      const [algorithm, salt, key] = saved.passwordHash.split("$");
      expect(algorithm).toBe("scrypt");
      expect(salt).toHaveLength(32);
      expect(scryptSync(valid.password, Buffer.from(salt, "hex"), 64).toString("hex")).toBe(key);
      expect(saved.passwordHash).not.toContain(valid.password);
      expect(secondConnection.findByEmail("NUEVO@EXAMPLE.COM")?.id).toBe(result.id);
    } finally { secondConnection.close(); }
  });

  it("la misma contraseña recibe un salt distinto por usuario", async () => {
    await service.register({ ...valid, email: "salt@example.com" });
    expect(repository.findByEmail("salt@example.com")!.passwordHash).not.toBe(repository.findByEmail(valid.email)!.passwordHash);
  });

  it.each([
    { username: " " }, { username: "a".repeat(81) }, { email: "invalido" },
    { email: "a".repeat(250) + "@x.com" }, { password: "corta" }, { password: 12345678 },
    { password: "x".repeat(1025) },
  ])("rechaza campos inválidos: %j", async (change) => {
    await expect(service.register({ ...valid, ...change })).rejects.toBeInstanceOf(InvalidRegistrationError);
  });

  it("SQLite impide duplicados aun si se omite la comprobación del servicio", () => {
    const existing = repository.findByEmail(valid.email)!;
    expect(() => repository.create({ ...existing, id: "otro-id", email: "NUEVO@EXAMPLE.COM" })).toThrow(DuplicateEmailError);
  });

  it("persiste después de cerrar y reabrir la base de datos", () => {
    const dbPath = join(directory, "restart.sqlite");
    const first = new SqliteUserRepository(dbPath);
    const user = repository.findByEmail(valid.email)!;
    const saved = first.create({
      username: user.username,
      email: "restart@example.com",
      passwordHash: user.passwordHash,
      plan: user.plan,
      createdAt: user.createdAt,
    });
    first.close();
    const reopened = new SqliteUserRepository(dbPath);
    try { expect(reopened.findByEmail("restart@example.com")?.id).toBe(saved.id); }
    finally { reopened.close(); }
  });

  it("persists the selected user plan", () => {
    repository.create({
      username: "Pro",
      email: "pro@example.com",
      passwordHash: "hash",
      plan: "PRO",
      createdAt: new Date().toISOString(),
    });
    expect(repository.findByEmail("pro@example.com")?.plan).toBe("PRO");
  });

  it("migrates existing text IDs and recovery tokens without losing accounts", () => {
    const dbPath = join(directory, "legacy.sqlite");
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'BASICO',
        created_at TEXT NOT NULL
      );
      CREATE TABLE password_recovery_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
    legacy.prepare(
      "INSERT INTO users (id, username, email, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("uuid-anterior", "Cuenta antigua", "antigua@example.com", "hash", "PRO", new Date().toISOString());
    legacy.prepare(
      "INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
    ).run("uuid-anterior", "token-hash", new Date(Date.now() + 60_000).toISOString(), new Date().toISOString());
    legacy.close();

    const migrated = new SqliteUserRepository(dbPath);
    try {
      const savedUser = migrated.findByEmail("antigua@example.com")!;
      expect(savedUser).toMatchObject({
        username: "Cuenta antigua",
        plan: "PRO",
      });
      expect(typeof savedUser.id).toBe("number");
      expect(migrated.updatePasswordWithRecoveryToken(
        "token-hash",
        "nuevo-hash",
        new Date().toISOString(),
      )).toBe(true);
      expect(migrated.findByEmail("antigua@example.com")?.passwordHash).toBe("nuevo-hash");
    } finally {
      migrated.close();
    }
  });
});

describe("API de registro", () => {
  it("201 sin contraseña ni hash en la respuesta", async () => {
    const response = await post({ ...valid, email: "http@example.com" });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe("http@example.com");
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body.user).not.toHaveProperty("password");
  });
  it("409 para un correo repetido con espacios y mayúsculas", async () => {
    expect((await post({ ...valid, email: " HTTP@EXAMPLE.COM " })).status).toBe(409);
  });
  it("400 para datos ausentes y JSON inválido", async () => {
    expect((await post({})).status).toBe(400);
    const malformed = await fetch(`${endpoint}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect(malformed.status).toBe(400);
  });
  it("solo una solicitud concurrente registra el mismo correo", async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => post({ ...valid, email: index % 2 ? " RACE@EXAMPLE.COM " : "race@example.com" })));
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
  });
  it("consulta disponibilidad de correos nuevos, usados e inválidos", async () => {
    expect(await (await fetch(`${endpoint}/check-email?email=libre%40example.com`)).json()).toEqual({ available: true });
    expect(await (await fetch(`${endpoint}/check-email?email=HTTP%40EXAMPLE.COM`)).json()).toEqual({ available: false });
    expect((await fetch(`${endpoint}/check-email?email=no`)).status).toBe(400);
  });
  it("un fallo de persistencia devuelve 500 sin exponer detalles internos", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = createApp({ findFixedDepositsByDepartment: async () => [] }, {
      findByEmail: () => { throw new Error("ruta privada de la base"); },
      create: (user) => ({ ...user, id: 1 }),
    }).listen(0);
    try {
      await once(failing, "listening");
      const response = await fetch(`http://localhost:${(failing.address() as AddressInfo).port}/api/users/register`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(valid),
      });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("ruta privada");
    } finally {
      await new Promise<void>((resolve) => failing.close(() => resolve()));
      log.mockRestore();
    }
  });
});
