import type { ParametrosPlazoFijo, ResultadoPlazoFijo } from "./tipos";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/** Adaptador mínimo de US08 al endpoint existente de US10. */
export async function simularPlazoFijo(
  parametros: ParametrosPlazoFijo,
  signal: AbortSignal,
): Promise<ResultadoPlazoFijo[]> {
  const respuesta = await fetch(`${API_URL}/api/simulations/fixed-deposits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parametros),
    signal,
  });
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new Error(typeof cuerpo?.message === "string"
      ? cuerpo.message : "No se pudo realizar la simulación. Inténtalo de nuevo.");
  }
  return await respuesta.json() as ResultadoPlazoFijo[];
}
