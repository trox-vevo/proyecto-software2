import type { ProAccessService } from "../../auth/application/ProAccessService";
import type { SimulationResult } from "../domain/SimulationResult";

// US27 · Escenario 1: borra la calificación en el servidor si el usuario no es Pro (o no hay sesión).
export class RiskRatingFilter {
  constructor(private readonly proAccessService: ProAccessService) {}

  apply(results: SimulationResult[], userId: number | undefined): SimulationResult[] {
    const isPro = userId !== undefined && this.proAccessService.hasProAccess(userId);
    if (!isPro) results.forEach((result) => result.hideRiskRating());
    return results;
  }
}
