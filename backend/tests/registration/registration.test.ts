import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { InvalidRegistrationError, RegistrationService } from "../../src/registration/application/RegistrationService";
import { DuplicateEmailError } from "../../src/registration/domain/UserRepository";
import { SqliteUserRepository, UserSchemaMigrationRequiredError } from "../../src/registration/infrastructure/SqliteUserRepository";
import { numericIdentifier } from "../../src/registration/domain/NumericIdentifier";

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
    expect(Number.isSafeInteger(result.id)).toBe(true);
    expect(result.id).toBeGreaterThan(0);
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
    expect(() => repository.create({
      username: existing.username, email: "NUEVO@EXAMPLE.COM", passwordHash: existing.passwordHash,
      plan: existing.plan, createdAt: existing.createdAt,
    })).toThrow(DuplicateEmailError);
  });

  it("persiste después de cerrar y reabrir la base de datos", () => {
    const dbPath = join(directory, "restart.sqlite");
    const first = new SqliteUserRepository(dbPath);
    const original = repository.findByEmail(valid.email)!;
    const saved = first.create({ username: original.username, email: original.email, passwordHash: original.passwordHash, plan: original.plan, createdAt: original.createdAt });
    first.close();
    const reopened = new SqliteUserRepository(dbPath);
    try { expect(reopened.findByEmail(valid.email)?.id).toBe(saved.id); }
    finally { reopened.close(); }
  });
});

describe("API de registro", () => {
  it("201 sin contraseña ni hash en la respuesta", async () => {
    const response = await post({ ...valid, email: "http@example.com" });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe("http@example.com");
    expect(typeof body.user.id).toBe("number");
    expect(Number.isSafeInteger(body.user.id)).toBe(true);
    expect(repository.findByEmail(body.user.email)?.id).toBe(body.user.id);
    expect(() => JSON.stringify(body)).not.toThrow();
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body.user).not.toHaveProperty("password");
  });
  it("409 para un correo repetido con espacios y mayúsculas", async () => {
    expect((await post({ ...valid, email: " HTTP@EXAMPLE.COM " })).status).toBe(409);
  });
  it("una identidad enviada por el cliente no sustituye la asignación de SQLite", async () => {
    const response = await post({ ...valid, email: "client-id@example.com", id: "uuid-proporcionado-por-cliente" });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(Number.isSafeInteger(body.user.id) && body.user.id > 0).toBe(true);
    expect(repository.findByEmail("client-id@example.com")?.id).toBe(body.user.id);
  });
  it("400 para datos ausentes y JSON inválido", async () => {
    expect((await post({})).status).toBe(400);
    const malformed = await fetch(`${endpoint}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect(malformed.status).toBe(400);
  });
  it("solo una solicitud concurrente registra el mismo correo", async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, (_, index) => post({ ...valid, email: index % 2 ? " RACE@EXAMPLE.COM " : "race@example.com" })));
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    const created = responses.find((response) => response.status === 201)!;
    expect((await created.json()).user.id).toBe(repository.findByEmail("race@example.com")?.id);
  });
  it("consulta disponibilidad de correos nuevos, usados e inválidos", async () => {
    expect(await (await fetch(`${endpoint}/check-email?email=libre%40example.com`)).json()).toEqual({ available: true });
    expect(await (await fetch(`${endpoint}/check-email?email=HTTP%40EXAMPLE.COM`)).json()).toEqual({ available: false });
    expect((await fetch(`${endpoint}/check-email?email=no`)).status).toBe(400);
  });
  it("un fallo de persistencia devuelve 500 sin exponer detalles internos", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = createApp({ findFixedDepositsByDepartment: async () => [] }, {
      findByEmail: () => { throw new Error("ruta privada de la base"); }, create: (user) => ({ ...user, id: 1 }),
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

describe("Contrato numérico y protección de esquemas existentes", () => {
  const pendingUser = {
    username: "Usuario sintético", email: "numeric@example.com", passwordHash: "hash-preservado-de-prueba",
    plan: "BASICO" as const, createdAt: "2026-11-06T00:00:00.000Z",
  };

  it.each([1, Number.MAX_SAFE_INTEGER, 1n, BigInt(Number.MAX_SAFE_INTEGER)])("admite únicamente enteros positivos exactos %s", (value) => {
    expect(numericIdentifier(value)).toBe(Number(value));
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 0n, -1n, BigInt(Number.MAX_SAFE_INTEGER) + 1n, "1", "uuid-anterior", null])("rechaza identificadores inválidos o imprecisos %s", (value) => {
    expect(() => numericIdentifier(value)).toThrow(RangeError);
  });

  it.each([0, Number.MAX_SAFE_INTEGER + 1])("el servicio no expone una identidad inválida del adaptador %s", async (id) => {
    const incompatible = new RegistrationService({ findByEmail: () => null, create: (user) => ({ ...user, id }) });
    await expect(incompatible.register({ ...valid, email: "adapter@example.com" })).rejects.toThrow(RangeError);
  });

  it("SQLite genera identidades distintas sin recibir un id del servicio", async () => {
    const records = await Promise.all(Array.from({ length: 4 }, (_, index) => service.register({ ...valid, email: `numeric-${index}@example.com` })));
    expect(new Set(records.map((record) => record.id)).size).toBe(4);
    for (const record of records) expect(Number.isSafeInteger(record.id) && record.id > 0).toBe(true);
    const database = new DatabaseSync(file, { readOnly: true });
    try {
      expect(database.prepare("PRAGMA table_info(users)").all()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "id", type: "INTEGER", pk: 1 })]));
    } finally { database.close(); }
  });

  it("detecta la base UUID antigua antes de modificarla y mantiene su contenido", () => {
    const legacyPath = join(directory, "legacy.sqlite");
    const legacy = new DatabaseSync(legacyPath);
    legacy.exec("CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, email TEXT UNIQUE COLLATE NOCASE, password_hash TEXT, plan TEXT, created_at TEXT)");
    legacy.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run("uuid-legado", pendingUser.username, pendingUser.email, pendingUser.passwordHash, pendingUser.plan, pendingUser.createdAt);
    legacy.close();
    const before = readFileSync(legacyPath);
    expect(() => new SqliteUserRepository(legacyPath)).toThrow(UserSchemaMigrationRequiredError);
    expect(readFileSync(legacyPath)).toEqual(before);
    const unchanged = new DatabaseSync(legacyPath, { readOnly: true });
    try {
      expect(unchanged.prepare("SELECT id, password_hash FROM users").get()).toEqual({ id: "uuid-legado", password_hash: pendingUser.passwordHash });
      expect(unchanged.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    } finally { unchanged.close(); }
  });

  it("rechaza una PK INTEGER que no permite generación rowid", () => {
    const incompatiblePath = join(directory, "without-rowid.sqlite");
    const incompatible = new DatabaseSync(incompatiblePath);
    incompatible.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT) WITHOUT ROWID");
    incompatible.close();
    expect(() => new SqliteUserRepository(incompatiblePath)).toThrow(UserSchemaMigrationRequiredError);
  });

  it("detecta ids int64 fuera del rango seguro al leer y revierte un alta imprecisa", () => {
    const boundaryPath = join(directory, "boundary.sqlite");
    const boundary = new DatabaseSync(boundaryPath);
    boundary.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, email TEXT UNIQUE COLLATE NOCASE, password_hash TEXT, plan TEXT, created_at TEXT)");
    boundary.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run(BigInt(Number.MAX_SAFE_INTEGER), pendingUser.username, "limit@example.com", pendingUser.passwordHash, pendingUser.plan, pendingUser.createdAt);
    boundary.close();
    const limited = new SqliteUserRepository(boundaryPath);
    try {
      expect(limited.findByEmail("limit@example.com")?.id).toBe(Number.MAX_SAFE_INTEGER);
      expect(() => limited.create(pendingUser)).toThrow(RangeError);
      expect(limited.findByEmail(pendingUser.email)).toBeNull();
    } finally { limited.close(); }
    const unsafe = new DatabaseSync(boundaryPath);
    unsafe.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run(BigInt(Number.MAX_SAFE_INTEGER) + 1n, pendingUser.username, "unsafe@example.com", pendingUser.passwordHash, pendingUser.plan, pendingUser.createdAt);
    unsafe.close();
    const reader = new SqliteUserRepository(boundaryPath);
    try { expect(() => reader.findByEmail("unsafe@example.com")).toThrow(RangeError); }
    finally { reader.close(); }
  });

  it("mantiene DuplicateEmailError al repetir un correo en el límite numérico", () => {
    const limitPath = join(directory, "duplicate-at-limit.sqlite");
    const limited = new SqliteUserRepository(limitPath);
    const seed = new DatabaseSync(limitPath);
    seed.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run(BigInt(Number.MAX_SAFE_INTEGER), pendingUser.username, pendingUser.email, pendingUser.passwordHash, pendingUser.plan, pendingUser.createdAt);
    seed.close();
    try {
      expect(() => limited.create({ ...pendingUser, email: pendingUser.email.toUpperCase() })).toThrow(DuplicateEmailError);
      expect(limited.findByEmail(pendingUser.email)?.id).toBe(Number.MAX_SAFE_INTEGER);
    } finally { limited.close(); }
  });

  it("dos registros concurrentes conservan 201 y 409 al alcanzar el límite numérico", async () => {
    const limitPath = join(directory, "concurrent-at-limit.sqlite");
    const limited = new SqliteUserRepository(limitPath);
    const seed = new DatabaseSync(limitPath);
    seed.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run(BigInt(Number.MAX_SAFE_INTEGER) - 1n, pendingUser.username, pendingUser.email, pendingUser.passwordHash, pendingUser.plan, pendingUser.createdAt);
    seed.close();
    const limitedServer = createApp({ findFixedDepositsByDepartment: async () => [] }, limited).listen(0);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await once(limitedServer, "listening");
      const url = `http://localhost:${(limitedServer.address() as AddressInfo).port}/api/users/register`;
      const responses = await Promise.all(["race-limit@example.com", " RACE-LIMIT@EXAMPLE.COM "].map((email) => fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...valid, email }),
      })));
      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
      const created = await responses.find((response) => response.status === 201)!.json();
      expect(created.user.id).toBe(Number.MAX_SAFE_INTEGER);
      expect(limited.findByEmail("race-limit@example.com")?.id).toBe(created.user.id);
      expect(log).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => limitedServer.close(() => resolve()));
      limited.close();
      log.mockRestore();
    }
  });
});
