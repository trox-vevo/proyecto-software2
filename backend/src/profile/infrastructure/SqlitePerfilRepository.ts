import type { DatabaseSync } from "node:sqlite";
import { PerfilUsuario } from "../domain/PerfilUsuario";
import type { RepositorioPerfiles } from "../domain/RepositorioPerfiles";

interface UsuarioRow {
  id: number;
  username: string;
  email: string;
}

/**
 * US16: el perfil es el mismo usuario registrado (tabla users), no un archivo aparte.
 * El id llega como texto (contrato de RepositorioPerfiles) y en la base es INTEGER.
 */
export class SqlitePerfilRepository implements RepositorioPerfiles {
  constructor(private readonly database: DatabaseSync) {}

  buscarPorId(id: string): PerfilUsuario | undefined {
    const userId = toUserId(id);
    if (userId === null) return undefined;
    const row = this.database
      .prepare("SELECT id, username, email FROM users WHERE id = ?")
      .get(userId) as unknown as UsuarioRow | undefined;
    return row ? new PerfilUsuario(String(row.id), row.username, row.email) : undefined;
  }

  correoEnUso(correo: string, excluirId: string): boolean {
    const row = this.database
      .prepare("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id <> ?")
      .get(correo, toUserId(excluirId) ?? -1);
    return row !== undefined;
  }

  guardar(perfil: PerfilUsuario): void {
    const userId = toUserId(perfil.id);
    if (userId === null) return;
    this.database
      .prepare("UPDATE users SET username = ?, email = ? WHERE id = ?")
      .run(perfil.nombre, perfil.correo, userId);
  }
}

function toUserId(id: string): number | null {
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 && String(value) === id ? value : null;
}
