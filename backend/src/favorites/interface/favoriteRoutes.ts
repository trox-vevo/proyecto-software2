import { Router } from "express";
import type { ProAccessService } from "../../auth/application/ProAccessService";
import type { FavoriteService } from "../application/FavoriteService";
import { FavoriteError, isEntityId, type ResolveUser } from "../domain/Favorite";

export function createFavoriteRouter(
  resolveUser: ResolveUser,
  service?: FavoriteService,
  proAccessService?: Pick<ProAccessService, "hasProAccess">,
): Router {
  const router = Router();
  router.post("/", async (req, res, next) => {
    try {
      const user = await resolveUser(req);
      if (!user || !isEntityId(user.id)) throw new FavoriteError(401, "AUTHENTICATION_REQUIRED", "Inicia sesión para guardar una simulación favorita.");
      const hasProAccess = proAccessService
        ? proAccessService.hasProAccess(user.id)
        : user.plan === "PRO";
      if (!hasProAccess) throw new FavoriteError(403, "PRO_REQUIRED", "Guardar favoritos es un beneficio del Plan Pro.");
      if (!service) throw new FavoriteError(503, "FAVORITES_UNAVAILABLE", "El guardado de favoritos está pendiente de integración.");
      const result = await service.save(user, req.body);
      res.status(result.created ? 201 : 200).json({
        favorite: result.favorite,
        created: result.created,
        message: result.created ? "Simulación guardada como favorita." : "Esta simulación ya estaba guardada.",
      });
    } catch (error) {
      if (error instanceof FavoriteError) {
        res.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });
  return router;
}
