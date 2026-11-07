import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PerfilUsuario } from "../domain/PerfilUsuario";
import type { RepositorioPerfiles } from "../domain/RepositorioPerfiles";

export class RepositorioPerfilesJson implements RepositorioPerfiles {
  constructor(
    private readonly archivo = path.join(process.cwd(), "data", "perfiles.json"),
  ) {}

  buscarPorId(id: string): PerfilUsuario | undefined {
    return this.leer().find((perfil) => perfil.id === id);
  }

  correoEnUso(correo: string, excluirId: string): boolean {
    const correoNormalizado = correo.toLowerCase();
    return this.leer().some(
      (perfil) => perfil.id !== excluirId && perfil.correo.toLowerCase() === correoNormalizado,
    );
  }

  guardar(perfilActualizado: PerfilUsuario): void {
    const perfiles = this.leer();
    const indice = perfiles.findIndex((perfil) => perfil.id === perfilActualizado.id);
    if (indice === -1) {
      throw new Error(`No se puede actualizar el perfil ${perfilActualizado.id}: no existe.`);
    }

    perfiles[indice] = perfilActualizado;
    writeFileSync(this.archivo, `${JSON.stringify(perfiles, null, 2)}\n`, "utf-8");
  }

  private leer(): PerfilUsuario[] {
    const datos: unknown = JSON.parse(readFileSync(this.archivo, "utf-8"));
    if (!Array.isArray(datos)) {
      throw new Error(`${this.archivo} debe contener un arreglo de perfiles`);
    }

    return datos.map((perfil: unknown) => {
      if (typeof perfil !== "object" || perfil === null) {
        throw new Error(`${this.archivo} contiene un perfil inválido`);
      }
      const registro = perfil as Record<string, unknown>;
      if (
        typeof registro.id !== "string" ||
        typeof registro.nombre !== "string" ||
        typeof registro.correo !== "string"
      ) {
        throw new Error(`${this.archivo} contiene un perfil inválido`);
      }
      return new PerfilUsuario(registro.id, registro.nombre, registro.correo);
    });
  }
}
