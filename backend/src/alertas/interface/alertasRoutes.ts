import { Router, type Request } from "express";
import type { ServicioAlertas } from "../application/ServicioAlertas";

/** Devuelve el id del usuario autenticado, o null si no hay sesión válida. */
export type ResolverUsuarioId = (req: Request) => Promise<number | null>;

const SIN_SESION = "Inicia sesión para ver tus alertas.";
const ID_VALIDO = /^[1-9]\d{0,15}$/;

export function createAlertasRouter(
  servicio: Pick<ServicioAlertas, "listar" | "marcarLeida">,
  resolverUsuarioId: ResolverUsuarioId,
) {
  const router = Router();

  // US36 / US35: alertas del usuario con su cobertura FSD.
  router.get("/", async (req, res, next) => {
    try {
      const usuarioId = await resolverUsuarioId(req);
      if (usuarioId === null) {
        res.status(401).json({ message: SIN_SESION });
        return;
      }
      res.json({ alertas: servicio.listar(usuarioId) });
    } catch (error) {
      next(error);
    }
  });

  // TS-110: persiste que la alerta ya se leyó. Es idempotente.
  router.patch("/:id/leida", async (req, res, next) => {
    try {
      const usuarioId = await resolverUsuarioId(req);
      if (usuarioId === null) {
        res.status(401).json({ message: SIN_SESION });
        return;
      }
      const id = ID_VALIDO.test(req.params.id) ? Number(req.params.id) : Number.NaN;
      if (!Number.isSafeInteger(id)) {
        res.status(400).json({ message: "El identificador de la alerta no es válido." });
        return;
      }
      // Una alerta de otro usuario responde igual que una inexistente, para no revelar qué ids existen.
      if (!servicio.marcarLeida(usuarioId, id)) {
        res.status(404).json({ message: "Alerta no encontrada." });
        return;
      }
      res.json({ id, leida: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
