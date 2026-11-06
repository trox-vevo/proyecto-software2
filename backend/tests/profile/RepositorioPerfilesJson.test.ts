import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PerfilUsuario } from "../../src/profile/domain/PerfilUsuario";
import { RepositorioPerfilesJson } from "../../src/profile/infrastructure/RepositorioPerfilesJson";

let directorioTemporal: string;

afterEach(() => {
  if (directorioTemporal !== undefined) {
    rmSync(directorioTemporal, { recursive: true, force: true });
  }
});

function crearRepositorio(perfiles: PerfilUsuario[]) {
  directorioTemporal = mkdtempSync(path.join(os.tmpdir(), "perfiles-test-"));
  const archivo = path.join(directorioTemporal, "perfiles.json");
  writeFileSync(archivo, JSON.stringify(perfiles), "utf-8");
  return { archivo, repositorio: new RepositorioPerfilesJson(archivo) };
}

describe("RepositorioPerfilesJson", () => {
  it("persiste el perfil actualizado y detecta correos duplicados sin distinguir mayúsculas", () => {
    const perfiles = [
      new PerfilUsuario("uno", "Usuario uno", "uno@ejemplo.com"),
      new PerfilUsuario("dos", "Usuario dos", "dos@ejemplo.com"),
    ];
    const { archivo, repositorio } = crearRepositorio(perfiles);
    const actualizado = new PerfilUsuario("uno", "Ana", "ana@ejemplo.com");

    repositorio.guardar(actualizado);

    expect(new RepositorioPerfilesJson(archivo).buscarPorId("uno")).toEqual(actualizado);
    expect(repositorio.correoEnUso("DOS@EJEMPLO.COM", "uno")).toBe(true);
    expect(JSON.parse(readFileSync(archivo, "utf-8"))).toHaveLength(2);
  });
});
