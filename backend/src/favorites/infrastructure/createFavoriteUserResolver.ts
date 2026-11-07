import { isEntityId, type ResolveUser } from "../domain/Favorite";
import type { User } from "../../registration/domain/User";

/** El middleware JWT de main debe ejecutarse antes. El plan siempre se consulta en SQLite. */
export function createFavoriteUserResolver(users: {
  findById(id: number): Pick<User, "id" | "plan"> | null;
}): ResolveUser {
  return async (request) => {
    if (!isEntityId(request.userId)) return null;
    const user = users.findById(request.userId);
    if (!user || !isEntityId(user.id) || user.id !== request.userId) return null;
    return { id: user.id, plan: user.plan };
  };
}
