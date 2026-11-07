import {
  CorreoDuplicadoError,
  DatosPerfilInvalidosError,
  PerfilNoEncontradoError,
} from "./ErroresPerfil";
import { PerfilUsuario } from "../domain/PerfilUsuario";
import type { RepositorioPerfiles } from "../domain/RepositorioPerfiles";

export class ServicioPerfiles {
  constructor(private readonly repositorio: RepositorioPerfiles) {}

  obtener(id: string): PerfilUsuario {
    const perfil = this.repositorio.buscarPorId(id);
    if (perfil === undefined) throw new PerfilNoEncontradoError("No se encontró el perfil.");
    return perfil;
  }

  actualizar(id: string, datos: unknown): PerfilUsuario {
    if (typeof datos !== "object" || datos === null) {
      throw new DatosPerfilInvalidosError("Debes proporcionar un nombre y un correo válidos.");
    }

    const { nombre, correo } = datos as Record<string, unknown>;
    if (typeof nombre !== "string" || typeof correo !== "string") {
      throw new DatosPerfilInvalidosError("Debes proporcionar un nombre y un correo válidos.");
    }

    const nombreNormalizado = nombre.trim();
    const correoNormalizado = correo.trim().toLowerCase();
    if (
      nombreNormalizado.length === 0 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)
    ) {
      throw new DatosPerfilInvalidosError("El nombre y el correo son obligatorios y deben ser válidos.");
    }

    const perfilActual = this.repositorio.buscarPorId(id);
    if (perfilActual === undefined) throw new PerfilNoEncontradoError("No se encontró el perfil.");
    if (this.repositorio.correoEnUso(correoNormalizado, id)) {
      throw new CorreoDuplicadoError("Ese correo ya está asociado a otro usuario.");
    }

    const perfilActualizado = new PerfilUsuario(id, nombreNormalizado, correoNormalizado);
    this.repositorio.guardar(perfilActualizado);
    return perfilActualizado;
  }
}
