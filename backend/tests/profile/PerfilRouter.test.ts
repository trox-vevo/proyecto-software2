import { once } from "node:events";
import { Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { PerfilUsuario } from "../../src/profile/domain/PerfilUsuario";
import type { RepositorioPerfiles } from "../../src/profile/domain/RepositorioPerfiles";

class RepositorioPerfilesMemoria implements RepositorioPerfiles {
  private perfiles = [
    new PerfilUsuario("usuario-demo", "Usuario de demostración", "usuario@ejemplo.com"),
    new PerfilUsuario("otro-usuario", "Otro usuario", "otro@ejemplo.com"),
  ];

  buscarPorId(id: string) {
    return this.perfiles.find((perfil) => perfil.id === id);
  }

  correoEnUso(correo: string, excluirId: string) {
    return this.perfiles.some(
      (perfil) => perfil.id !== excluirId && perfil.correo.toLowerCase() === correo.toLowerCase(),
    );
  }

  guardar(perfilActualizado: PerfilUsuario) {
    this.perfiles = this.perfiles.map((perfil) =>
      perfil.id === perfilActualizado.id ? perfilActualizado : perfil,
    );
  }

  reiniciar() {
    this.perfiles = [
      new PerfilUsuario("usuario-demo", "Usuario de demostración", "usuario@ejemplo.com"),
      new PerfilUsuario("otro-usuario", "Otro usuario", "otro@ejemplo.com"),
    ];
  }
}

const repositorio = new RepositorioPerfilesMemoria();
let server: Server;
let endpoint: string;

beforeAll(async () => {
  server = createApp(
    { findFixedDepositsByDepartment: async () => [] },
    repositorio,
  ).listen(0);
  await once(server, "listening");
  endpoint = `http://localhost:${(server.address() as AddressInfo).port}/api/perfil`;
});

beforeEach(() => repositorio.reiniciar());

afterAll(() => {
  server.close();
});

describe("API de perfiles", () => {
  it("obtiene el perfil actual", async () => {
    const response = await fetch(endpoint);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "usuario-demo",
      nombre: "Usuario de demostración",
      correo: "usuario@ejemplo.com",
    });
  });

  it("actualiza nombre y correo y normaliza los espacios y mayúsculas", async () => {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "  Ana Pérez ", correo: " ANA@EJEMPLO.COM " }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "usuario-demo",
      nombre: "Ana Pérez",
      correo: "ana@ejemplo.com",
    });
    expect(repositorio.buscarPorId("usuario-demo")?.nombre).toBe("Ana Pérez");
  });

  it("rechaza un correo duplicado", async () => {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Ana", correo: "OTRO@EJEMPLO.COM" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: "Ese correo ya está asociado a otro usuario.",
    });
    expect(repositorio.buscarPorId("usuario-demo")?.correo).toBe("usuario@ejemplo.com");
  });

  it.each([
    { nombre: "", correo: "valido@ejemplo.com" },
    { nombre: "Ana", correo: "correo-invalido" },
  ])("rechaza los campos vacíos o inválidos: $nombre / $correo", async (datos) => {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("message");
  });
});
