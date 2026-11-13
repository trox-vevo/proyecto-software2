import { hasProAccess } from "../../registration/domain/User";
import type { UserRepository } from "../../registration/domain/UserRepository";

// US27: el plan y su vencimiento se consultan en el repositorio, no en el token.
// Depende solo de lo que usa (findById): las pruebas pasan un repositorio mínimo.
export class ProAccessService {
  constructor(private readonly userRepository: Pick<UserRepository, "findById">) {}

  hasProAccess(userId: number): boolean {
    const user = this.userRepository.findById(userId);
    return user !== null && hasProAccess(user); // usuario inexistente = sin acceso
  }
}
