import type { EconomistReport } from "../domain/EconomistReport";
import type { EconomistReportRepository } from "../domain/EconomistReportRepository";
import type { SbsRiskRepository } from "../domain/SbsRiskRepository";

// US26: busca el informe del economista y le agrega los indicadores de la SBS de la US25
export class EconomistReportService {
  constructor(
    private readonly reportRepository: EconomistReportRepository,
    private readonly sbsRiskRepository: SbsRiskRepository,
  ) {}

  getReport(entityId: number): EconomistReport | null {
    const report = this.reportRepository.findByEntityId(entityId);
    if (!report) return null;

    report.sbsProfile = this.sbsRiskRepository.findByEntityId(entityId);
    return report;
  }
}
