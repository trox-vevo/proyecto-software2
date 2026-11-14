import type { SimulationResult } from "../../simulation/domain/SimulationResult";
import type { SbsRiskRepository } from "../domain/SbsRiskRepository";

// US25: pone la calificación de la SBS en cada resultado de la simulación.
// Si la entidad no tiene datos, su calificación se queda en null.
export class RiskEvaluationService {
  constructor(private readonly sbsRiskRepository: SbsRiskRepository) {}

  assignRiskRatings(results: SimulationResult[]): SimulationResult[] {
    for (const result of results) {
      const profile = this.sbsRiskRepository.findByEntityId(result.productId);
      if (profile) result.assignRiskRating(profile.riskRating);
    }
    return results;
  }
}
