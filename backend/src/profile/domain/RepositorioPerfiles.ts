import { PerfilUsuario } from "./PerfilUsuario";

export interface RepositorioPerfiles {
  buscarPorId(id: string): PerfilUsuario | undefined;
  correoEnUso(correo: string, excluirId: string): boolean;
  guardar(perfil: PerfilUsuario): void;
}
