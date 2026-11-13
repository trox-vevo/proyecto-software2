import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { RiskEvaluationService } from "../../src/risk/application/RiskEvaluationService";
import { SbsRiskProfile } from "../../src/risk/domain/SbsRiskProfile";
import type { SbsRiskRepository } from "../../src/risk/domain/SbsRiskRepository";
import { ServiceChannels } from "../../src/simulation/domain/ServiceChannels";
import { SimulationResult } from "../../src/simulation/domain/SimulationResult";

// US25 (TS-80): repositorio falso, así la prueba no depende de data/sbs.json
const perfil = (entityId: number, riskRating: string) =>
  new SbsRiskProfile(entityId, `Entidad ${entityId}`, riskRating, new Decimal("0.15"), new Decimal("0.03"), new Decimal("0.25"), new Date("2026-09-30"), "https://www.sbs.gob.pe/");

const repositorio = (perfiles: SbsRiskProfile[]): SbsRiskRepository => ({
  findByEntityId: (entityId) => perfiles.find((p) => p.entityId === entityId) ?? null,
});

const resultado = (productId: number) =>
  new SimulationResult(productId, `Entidad ${productId}`, new Decimal("0.05"), new Decimal("50.00"), null, new ServiceChannels(true, true));

describe("RiskEvaluationService", () => {
  const service = new RiskEvaluationService(repositorio([perfil(1, "A+"), perfil(2, "B-")]));

  it("pone la calificación de la SBS en cada resultado", () => {
    const results = service.assignRiskRatings([resultado(1), resultado(2)]);

    expect(results.map((r) => r.riskRating)).toEqual(["A+", "B-"]);
  });

  it("si la entidad no tiene datos de la SBS, la calificación queda en null", () => {
    const results = service.assignRiskRatings([resultado(1), resultado(99)]);

    expect(results.map((r) => r.riskRating)).toEqual(["A+", null]);
  });

  it("devuelve la misma lista, en el mismo orden", () => {
    const lista = [resultado(2), resultado(1)];

    expect(service.assignRiskRatings(lista)).toBe(lista);
    expect(lista.map((r) => r.productId)).toEqual([2, 1]);
  });

  it("lista vacía", () => {
    expect(service.assignRiskRatings([])).toEqual([]);
  });
});

describe("SimulationResult.assignRiskRating", () => {
  it("guarda la calificación", () => {
    const result = resultado(1);
    result.assignRiskRating("A");
    expect(result.riskRating).toBe("A");
  });
});
