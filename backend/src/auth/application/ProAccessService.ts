import { hasProAccess } from "../../registration/domain/User";
import type { UserRepository } from "../../registration/domain/UserRepository";

// US27: el plan se consulta en el repositorio y no en el token, porque cambia (US33, US43).
// Depende solo de lo que usa (findById): las pruebas pasan un repositorio mínimo.
export class ProAccessService {
  constructor(private readonly userRepository: Pick<UserRepository, "findById">) {}

  hasProAccess(userId: number): boolean {
    const user = this.userRepository.findById(userId);
    return user !== null && hasProAccess(user); // usuario inexistente = sin acceso
  }
}
