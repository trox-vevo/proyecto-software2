import type { SbsRiskProfile } from "./SbsRiskProfile";

// US25: el servicio depende de esta interfaz y no de dónde salen los datos (hoy un JSON).
export interface SbsRiskRepository {
  // null si la entidad no tiene datos de la SBS
  findByEntityId(entityId: number): SbsRiskProfile | null;
}
