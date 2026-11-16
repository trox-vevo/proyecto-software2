import { useEffect, useRef, useState } from "react";
import { API_URL } from "./types";
import { fetchWithAuth } from "../auth/session";

/** US28: parámetros con los que el backend vuelve a simular un plazo fijo (FavoriteService). */
export interface FavoritoPlazoFijo {
  productId: number;
  entityName: string;
  amount: string;
  termDays: number;
  department: string;
  paymentMode: "AT_MATURITY" | "MONTHLY";
}

type Props = { onViewPlans: () => void } & (
  | { accountId: string; days: number }
  | { plazoFijo: FavoritoPlazoFijo }
);

/** Cuerpo del POST /api/favorites y nombre accesible del botón, según el instrumento. */
function describir(props: Props) {
  if ("plazoFijo" in props) {
    const { entityName, ...parametros } = props.plazoFijo;
    return { body: { instrument: "PLAZO_FIJO", ...parametros }, nombre: entityName };
  }
  return { body: { instrument: "AHORROS", accountId: props.accountId, days: props.days }, nombre: props.accountId };
}

export function FavoriteButton(props: Props) {
  const { onViewPlans } = props;
  const { body, nombre } = describir(props);
  const [status, setStatus] = useState<"idle" | "pending" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [showPlans, setShowPlans] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function save() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setStatus("pending");
    setMessage("");
    setShowPlans(false);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/favorites`, {
        method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (controller.signal.aborted) return;
      if (response.status === 200 || response.status === 201) {
        const result = await response.json();
        if (typeof result.favorite?.id !== "number" || !Number.isSafeInteger(result.favorite.id) || result.favorite.id <= 0 || typeof result.created !== "boolean") {
          throw new Error("Respuesta inválida");
        }
        setStatus("saved");
        setMessage(result.created ? "Simulación guardada como favorita." : "Esta simulación ya estaba guardada.");
      } else {
        setStatus("error");
        const messages: Record<number, string> = {
          401: "Inicia sesión con una cuenta válida para guardar favoritos.",
          403: "Guardar favoritos requiere el Plan Pro.",
          404: "La simulación ya no está disponible. Actualiza los resultados.",
          503: "El guardado está pendiente de integrar la cuenta y su persistencia.",
        };
        setMessage(messages[response.status] ?? "No se pudo guardar la simulación. Inténtalo nuevamente.");
        setShowPlans(response.status === 403);
      }
    } catch {
      if (!controller.signal.aborted) {
        setStatus("error");
        setMessage("No se pudo guardar la simulación. Revisa la conexión e inténtalo nuevamente.");
      }
    } finally { request.current = null; }
  }

  return <div className="favorito-accion">
    <button type="button" onClick={save} disabled={status === "pending" || status === "saved"} aria-label={`Guardar favorito de ${nombre}`}>
      {status === "pending" ? "Guardando…" : status === "saved" ? "Guardada" : "Guardar favorito"}
    </button>
    {message && <p role={status === "error" ? "alert" : "status"}>{message}</p>}
    {showPlans && <button type="button" onClick={onViewPlans}>Comparar planes</button>}
  </div>;
}
