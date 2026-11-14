import type { EconomistReport } from "./EconomistReport";

// US26: igual que SbsRiskRepository, el servicio no sabe de dónde salen los informes
export interface EconomistReportRepository {
  // null si la entidad no tiene informe
  findByEntityId(entityId: number): EconomistReport | null;
}
