import type { Request, Response } from "express";
import type { EconomistReportService } from "../application/EconomistReportService";
import type { EconomistReport } from "../domain/EconomistReport";
import type { SbsRiskProfile } from "../domain/SbsRiskProfile";

// Los ratios viajan como texto para no perder decimales; las fechas como "2026-09-30"
const fecha = (date: Date) => date.toISOString().slice(0, 10);

const perfilJson = (profile: SbsRiskProfile) => ({
  entityId: profile.entityId,
  entityName: profile.entityName,
  riskRating: profile.riskRating,
  capitalAdequacyRatio: profile.capitalAdequacyRatio.toFixed(4),
  delinquencyRate: profile.delinquencyRate.toFixed(4),
  liquidityRatio: profile.liquidityRatio.toFixed(4),
  reportDate: fecha(profile.reportDate),
  sourceUrl: profile.sourceUrl,
});

const toResponse = (report: EconomistReport) => ({
  entityId: report.entityId,
  entityName: report.entityName,
  summary: report.summary,
  strengths: report.strengths,
  risks: report.risks,
  recommendation: report.recommendation,
  author: report.author,
  publishedAt: fecha(report.publishedAt),
  sbsProfile: report.sbsProfile ? perfilJson(report.sbsProfile) : null,
});

// US26: GET /api/risk-reports/:entityId. Antes pasa por ProAccessMiddleware (US27),
// así que aquí ya sabemos que el usuario es Pro.
export class EconomistReportController {
  constructor(private readonly economistReportService: EconomistReportService) {}

  getReport = (req: Request, res: Response): void => {
    const entityId = Number(req.params.entityId);
    if (!Number.isInteger(entityId) || entityId <= 0) {
      res.status(400).json({ message: "La entidad indicada no es válida." });
      return;
    }

    const report = this.economistReportService.getReport(entityId);
    if (!report) {
      res.status(404).json({ message: "Informe no disponible" });
      return;
    }
    res.json(toResponse(report));
  };
}
