import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app";
import { ProAccessService } from "../../src/auth/application/ProAccessService";
import { ProAccessMiddleware } from "../../src/auth/interface/ProAccessMiddleware";
import { getJwtSecret } from "../../src/auth/jwtSecret";
import { hasProAccess, type User, type UserPlan } from "../../src/registration/domain/User";
import type { UserRepository } from "../../src/registration/domain/UserRepository";

// US27 (TS-85, TS-86): el bloqueo vive en el backend. Datos propios, sin usuarios.sqlite.
const user = (id: number, plan: UserPlan): User => ({
  id,
  username: `usuario${id}`,
  email: `usuario${id}@prueba.com`,
  passwordHash: "scrypt$00$00",
  plan,
  createdAt: "2026-11-08T00:00:00.000Z",
  planExpiresAt: null,
});
const users = [user(1, "BASICO"), user(2, "PRO")];
const repository: UserRepository = {
  findByEmail: (email) => users.find((u) => u.email === email) ?? null,
  findById: (id) => users.find((u) => u.id === id) ?? null,
  create: () => {
    throw new Error("no se usa en estas pruebas");
  },
  requestProCancellation: () => {
    throw new Error("no se usa en estas pruebas");
  },
};
const service = new ProAccessService(repository);

describe("hasProAccess (regla del dominio)", () => {
  it("solo el plan PRO tiene acceso", () => {
    expect(hasProAccess(user(1, "PRO"))).toBe(true);
    expect(hasProAccess(user(1, "BASICO"))).toBe(false);
    expect(hasProAccess({ ...user(1, "PRO"), planExpiresAt: new Date(Date.now() - 1).toISOString() })).toBe(false);
    expect(hasProAccess({ ...user(1, "PRO"), planExpiresAt: new Date(Date.now() + 1_000).toISOString() })).toBe(true);
  });
});

describe("ProAccessService", () => {
  it("consulta el plan en el repositorio: Pro sí, Básico no, inexistente no", () => {
    expect(service.hasProAccess(2)).toBe(true);
    expect(service.hasProAccess(1)).toBe(false);
    expect(service.hasProAccess(999)).toBe(false);
  });
});

describe("ProAccessMiddleware", () => {
  const run = (userId: number | undefined) => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    const next = vi.fn();
    new ProAccessMiddleware(service).handle(
      { userId } as Request,
      res as unknown as Response,
      next as NextFunction,
    );
    return { res, next };
  };

  it("401 sin sesión, sin llamar a next", () => {
    const { res, next } = run(undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("403 'Exclusivo Plan Pro' para un usuario Básico, sin llamar a next", () => {
    const { res, next } = run(1);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Exclusivo Plan Pro" });
    expect(next).not.toHaveBeenCalled();
  });

  it("deja pasar a un usuario Pro, sin responder", () => {
    const { res, next } = run(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// TS-86: un usuario Básico llama a la API directamente (consola, Postman) con su token real.
describe("GET /api/risk-reports/:id con la app real", () => {
  let server: Server;
  let baseUrl: string;
  const get = (token?: string) =>
    fetch(`${baseUrl}/api/risk-reports/1`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  const tokenFor = (id: number) => jwt.sign({ sub: String(id) }, getJwtSecret());

  beforeAll(async () => {
    const app = createApp({ findFixedDepositsByDepartment: async () => [] }, repository);
    server = app.listen(0);
    await once(server, "listening");
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("403 con el token de un usuario Básico", async () => {
    const response = await get(tokenFor(1));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Exclusivo Plan Pro" });
  });

  it("401 sin token", async () => {
    expect((await get()).status).toBe(401);
  });

  it("un token falsificado con otro secreto se trata como sin sesión (401)", async () => {
    const forged = jwt.sign({ sub: "2" }, "otro-secreto");
    expect((await get(forged)).status).toBe(401);
  });

  it("un usuario Pro pasa el bloqueo (la ruta del informe es de la US26)", async () => {
    expect([401, 403]).not.toContain((await get(tokenFor(2))).status);
  });
});
