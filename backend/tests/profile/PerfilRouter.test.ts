import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Server } from "node:http";
import { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import { SqliteUserRepository } from "../../src/registration/infrastructure/SqliteUserRepository";

let server: Server;
let endpoint: string;
let users: SqliteUserRepository;
let token: string;
let temporaryDirectory: string;

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "perfil-api-test-"));
  users = new SqliteUserRepository(join(temporaryDirectory, "users.sqlite"));
  const profileUser = users.create({
    username: "Usuario original",
    email: "original@ejemplo.com",
    passwordHash: "hash",
    plan: "BASICO",
    createdAt: new Date().toISOString(),
  });
  users.create({
    username: "Otro usuario",
    email: "otro@ejemplo.com",
    passwordHash: "hash",
    plan: "BASICO",
    createdAt: new Date().toISOString(),
  });
  token = jwt.sign({ sub: String(profileUser.id) }, getJwtSecret());
  server = createApp({ findFixedDepositsByDepartment: async () => [] }, users).listen(0);
  await once(server, "listening");
  endpoint = `http://localhost:${(server.address() as AddressInfo).port}/api/perfil`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  users.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("API de perfiles autenticados", () => {
  it("rechaza leer o modificar el perfil sin sesión", async () => {
    expect((await fetch(endpoint)).status).toBe(401);
    expect((await fetch(endpoint, { method: "PUT" })).status).toBe(401);
  });

  it("obtiene y persiste el perfil del usuario identificado por el JWT", async () => {
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    const before = await response.json();

    const update = await fetch(endpoint, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "  Ana Pérez ", correo: " ANA@EJEMPLO.COM " }),
    });
    expect(update.status).toBe(200);
    expect(await update.json()).toEqual({
      ...before,
      nombre: "Ana Pérez",
      correo: "ana@ejemplo.com",
    });
    expect(users.findById(Number(before.id))).toMatchObject({
      username: "Ana Pérez",
      email: "ana@ejemplo.com",
    });
  });

  it("rechaza el correo de otra cuenta sin modificar el perfil", async () => {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Cambio no guardado", correo: "OTRO@EJEMPLO.COM" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Ese correo ya está asociado a otro usuario.",
    });
    expect(users.findByEmail("ana@ejemplo.com")).toMatchObject({ username: "Ana Pérez" });
  });
});
