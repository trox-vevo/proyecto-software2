import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { optionalAuthMiddleware } from "../../src/auth/interface/optionalAuthMiddleware";

const secretAnterior = process.env.JWT_SECRET;
process.env.JWT_SECRET = "test-jwt-secret";
const app = express();
app.use(optionalAuthMiddleware);
app.get("/user", (req, res) => res.json({ userId: req.userId ?? null }));
let server: Server;
let endpoint: string;

beforeAll(async () => {
  server = app.listen(0);
  await once(server, "listening");
  endpoint = `http://localhost:${(server.address() as AddressInfo).port}/user`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (secretAnterior === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = secretAnterior;
});

describe("middleware opcional de autenticación", () => {
  it("continúa anónimamente si falta o no es válido el bearer token", async () => {
    const missing = await fetch(endpoint);
    const invalid = await fetch(endpoint, { headers: { Authorization: "Bearer inválido" } });
    expect(await missing.json()).toEqual({ userId: null });
    expect(await invalid.json()).toEqual({ userId: null });
  });

  it("verifica el JWT y asigna el subject numérico a la petición", async () => {
    const token = jwt.sign({ sub: "42" }, "test-jwt-secret");
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    expect(await response.json()).toEqual({ userId: 42 });
  });

  it("no asigna un subject que no sea un ID numérico positivo", async () => {
    const token = jwt.sign({ sub: "usuario" }, "test-jwt-secret");
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    expect(await response.json()).toEqual({ userId: null });
  });
});
