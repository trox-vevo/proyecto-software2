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
  async function requireProUser(request: Parameters<ResolveUser>[0]) {
    const user = await resolveUser(request);
    if (!user || !isEntityId(user.id)) throw new FavoriteError(401, "AUTHENTICATION_REQUIRED", "Inicia sesión para gestionar tus simulaciones favoritas.");
    const hasProAccess = proAccessService
      ? proAccessService.hasProAccess(user.id)
      : user.plan === "PRO";
    if (!hasProAccess) throw new FavoriteError(403, "PRO_REQUIRED", "Gestionar favoritos es un beneficio del Plan Pro.");
    return user;
  }

  router.post("/", async (req, res, next) => {
    try {
      const user = await requireProUser(req);
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

  router.get("/", async (req, res, next) => {
    try {
      const user = await requireProUser(req);
      if (!service) throw new FavoriteError(503, "FAVORITES_UNAVAILABLE", "La consulta de favoritos está pendiente de integración.");
      res.json({ favorites: service.list(user) });
    } catch (error) {
      if (error instanceof FavoriteError) {
        res.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  router.delete("/:favoriteId", async (req, res, next) => {
    try {
      const user = await requireProUser(req);
      if (!service) throw new FavoriteError(503, "FAVORITES_UNAVAILABLE", "La gestión de favoritos está pendiente de integración.");
      if (!/^[1-9]\d*$/.test(req.params.favoriteId) || !Number.isSafeInteger(Number(req.params.favoriteId))) {
        throw new FavoriteError(400, "INVALID_FAVORITE_ID", "El identificador del favorito no es válido.");
      }
      service.delete(user, Number(req.params.favoriteId));
      res.json({ deleted: true, message: "Simulación eliminada correctamente." });
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
