import { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "../auth/session";
import { API_URL } from "./types";

export type FavoriteParameters =
  | { instrument: "AHORROS"; accountId: string; days: number }
  | {
      instrument: "PLAZO_FIJO";
      productId: number;
      amount: string;
      termDays: 180 | 360 | 540 | 720 | 900 | 1080;
      department: string;
      paymentMode: "AT_MATURITY" | "MONTHLY";
    };

interface Favorite {
  id: number;
  parameters: FavoriteParameters;
  snapshot: unknown;
  createdAt: string;
}

function isParameters(value: unknown): value is FavoriteParameters {
  if (typeof value !== "object" || value === null) return false;
  const parameters = value as Record<string, unknown>;
  if (parameters.instrument === "AHORROS") {
    return typeof parameters.accountId === "string" && typeof parameters.days === "number" &&
      Number.isSafeInteger(parameters.days) && parameters.days > 0;
  }
  return parameters.instrument === "PLAZO_FIJO" &&
    typeof parameters.productId === "number" && Number.isSafeInteger(parameters.productId) && parameters.productId > 0 &&
    typeof parameters.amount === "string" &&
    typeof parameters.termDays === "number" && [180, 360, 540, 720, 900, 1080].includes(parameters.termDays) &&
    typeof parameters.department === "string" &&
    (parameters.paymentMode === "AT_MATURITY" || parameters.paymentMode === "MONTHLY");
}

function isFavorite(value: unknown): value is Favorite {
  if (typeof value !== "object" || value === null) return false;
  const favorite = value as Record<string, unknown>;
  return typeof favorite.id === "number" && Number.isSafeInteger(favorite.id) && favorite.id > 0 &&
    isParameters(favorite.parameters) && typeof favorite.createdAt === "string" &&
    Number.isFinite(Date.parse(favorite.createdAt));
}

function snapshotRecord(snapshot: unknown): Record<string, unknown> {
  return typeof snapshot === "object" && snapshot !== null ? snapshot as Record<string, unknown> : {};
}

function favoriteTitle(favorite: Favorite): string {
  const snapshot = snapshotRecord(favorite.snapshot);
  if (favorite.parameters.instrument === "AHORROS") {
    return typeof snapshot.nombreCuenta === "string" && snapshot.nombreCuenta
      ? snapshot.nombreCuenta
      : `Cuenta de ahorro ${favorite.parameters.accountId}`;
  }
  return typeof snapshot.entityName === "string" && snapshot.entityName
    ? snapshot.entityName
    : `Depósito a plazo fijo · ${favorite.parameters.department}`;
}

function favoriteAmount(favorite: Favorite): string {
  const amount = favorite.parameters.instrument === "PLAZO_FIJO"
    ? favorite.parameters.amount
    : snapshotRecord(favorite.snapshot).capitalInicial;
  return typeof amount === "string" && amount ? `S/ ${amount}` : "Monto no disponible";
}

export function SavedSimulations({
  onReplay,
  onViewPlans,
}: {
  onReplay: (parameters: FavoriteParameters) => void;
  onViewPlans: () => void;
}) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [exitingId, setExitingId] = useState<number | null>(null);
  const removalTimer = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchWithAuth(`${API_URL}/api/favorites`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 403) throw new Error("Mis simulaciones guardadas es un beneficio del Plan Pro.");
          if (response.status === 401) throw new Error("Inicia sesión con una cuenta Pro para consultar tus simulaciones.");
          throw new Error(`No se pudieron cargar las simulaciones (código ${response.status}).`);
        }
        const body: unknown = await response.json();
        if (typeof body !== "object" || body === null || !Array.isArray((body as Record<string, unknown>).favorites) ||
          !(body as { favorites: unknown[] }).favorites.every(isFavorite)) {
          throw new Error("El servidor devolvió un historial de simulaciones inválido.");
        }
        setFavorites((body as { favorites: Favorite[] }).favorites);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "No se pudieron cargar las simulaciones.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
      if (removalTimer.current !== null) window.clearTimeout(removalTimer.current);
    };
  }, []);

  async function deleteFavorite(favorite: Favorite) {
    if (deletingId !== null || !window.confirm(`¿Eliminar la simulación "${favoriteTitle(favorite)}" de tus favoritos?`)) return;
    setDeletingId(favorite.id);
    setError("");
    setMessage("");
    try {
      const response = await fetchWithAuth(`${API_URL}/api/favorites/${favorite.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const detail = typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
          ? body.message
          : `No se pudo eliminar la simulación (código ${response.status}).`;
        throw new Error(detail);
      }
      setExitingId(favorite.id);
      setMessage("Simulación eliminada correctamente.");
      removalTimer.current = window.setTimeout(() => {
        setFavorites((current) => current.filter((item) => item.id !== favorite.id));
        setExitingId(null);
        removalTimer.current = null;
      }, 220);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la simulación.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="simulaciones-guardadas" id="mis-simulaciones-guardadas" aria-labelledby="titulo-simulaciones-guardadas">
      <h2 id="titulo-simulaciones-guardadas">Mis Simulaciones Guardadas</h2>
      {loading && <p role="status">Cargando simulaciones guardadas…</p>}
      {error && <div role={error.includes("Plan Pro") || error.startsWith("Inicia sesión") ? "status" : "alert"}>
        <p>{error}</p>{error.includes("Plan Pro") && <button type="button" onClick={onViewPlans}>Ver planes Pro</button>}
      </div>}
      {message && <p role="status">{message}</p>}
      {!loading && !error && favorites.length === 0 && <p>Aún no tienes simulaciones guardadas.</p>}
      <div className="simulaciones-guardadas-lista">
        {favorites.map((favorite) => (
          <article className={`simulacion-guardada${exitingId === favorite.id ? " simulacion-guardada--saliendo" : ""}`} key={favorite.id}>
            <h3>{favoriteTitle(favorite)}</h3>
            <p>{favorite.parameters.instrument === "AHORROS" ? "Cuenta de ahorros" : "Depósito a plazo fijo"}</p>
            <dl>
              <div><dt>Guardada</dt><dd>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(favorite.createdAt))}</dd></div>
              <div><dt>Monto</dt><dd>{favoriteAmount(favorite)}</dd></div>
              <div><dt>Plazo</dt><dd>{favorite.parameters.instrument === "AHORROS" ? favorite.parameters.days : favorite.parameters.termDays} días</dd></div>
            </dl>
            <div className="simulacion-guardada-acciones">
              <button type="button" onClick={() => onReplay(favorite.parameters)}>Volver a simular</button>
              <button type="button" disabled={deletingId !== null} onClick={() => void deleteFavorite(favorite)}>
                {deletingId === favorite.id ? "Eliminando…" : "Eliminar favorito"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
