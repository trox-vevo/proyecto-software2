import type { NivelRiesgo } from "../semaforo/tipos";

// US25: color del semáforo según la calificación de la SBS. Solo A+ y A son verde,
// el resto de A y las B amarillo, y de C para abajo rojo.
// Si llega algo que no es una calificación, queda "Sin clasificar" (null).
export function nivelDeCalificacion(riskRating: string): NivelRiesgo | null {
  if (riskRating === "A+" || riskRating === "A") return "VERDE";
  if (/^(A-|B[+-]?)$/.test(riskRating)) return "AMARILLO";
  if (/^[CDE][+-]?$/.test(riskRating)) return "ROJO";
  return null;
}
