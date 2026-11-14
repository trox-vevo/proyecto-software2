import {
  CorreoDuplicadoError,
  DatosPerfilInvalidosError,
  PerfilNoEncontradoError,
} from "./ErroresPerfil";
import { DuplicateEmailError, type UserRepository } from "../../registration/domain/UserRepository";

export class ServicioPerfiles {
  constructor(private readonly repositorio: UserRepository) {}

  obtener(id: number) {
    const usuario = this.repositorio.findById(id);
    if (usuario === null) throw new PerfilNoEncontradoError("No se encontró el perfil.");
    return { id: String(usuario.id), nombre: usuario.username, correo: usuario.email };
  }

  actualizar(id: number, datos: unknown) {
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
      nombreNormalizado.length > 80 ||
      correoNormalizado.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado)
    ) {
      throw new DatosPerfilInvalidosError("El nombre y el correo son obligatorios y deben ser válidos.");
    }

    try {
      const usuario = this.repositorio.updateProfile(id, nombreNormalizado, correoNormalizado);
      if (usuario === null) throw new PerfilNoEncontradoError("No se encontró el perfil.");
      return { id: String(usuario.id), nombre: usuario.username, correo: usuario.email };
    } catch (error: unknown) {
      if (error instanceof DuplicateEmailError) {
        throw new CorreoDuplicadoError("Ese correo ya está asociado a otro usuario.");
      }
      throw error;
    }
  }
}
