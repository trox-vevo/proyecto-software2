import { RiskLevel } from "./RiskLevel";

/**
 * US22/US23: color del semáforo a partir de la calificación de la SBS.
 * Misma regla que frontend/src/risk/nivelDeCalificacion.ts (plazo fijo y alertas),
 * para que ahorros y plazo fijo muestren el mismo color para la misma entidad.
 * null = sin clasificar (no es un cuarto nivel).
 */
export function riskLevelFromRating(riskRating: string): RiskLevel | null {
  if (riskRating === "A+" || riskRating === "A") return RiskLevel.VERDE;
  if (/^(A-|B[+-]?)$/.test(riskRating)) return RiskLevel.AMARILLO;
  if (/^[CDE][+-]?$/.test(riskRating)) return RiskLevel.ROJO;
  return null;
}
