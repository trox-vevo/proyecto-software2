import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { ProAccessService } from "../../../src/auth/application/ProAccessService";
import { RiskRatingFilter } from "../../../src/simulation/application/RiskRatingFilter";
import { ServiceChannels } from "../../../src/simulation/domain/ServiceChannels";
import { SimulationResult } from "../../../src/simulation/domain/SimulationResult";

// US27 · Escenario 1: la calificación se borra en el servidor; nunca llega al navegador.
const PRO_ID = 2;
const BASIC_ID = 1;
const filter = new RiskRatingFilter(
  new ProAccessService({
    findById: (id) =>
      id === PRO_ID || id === BASIC_ID
        ? {
            id,
            username: "u",
            email: "u@prueba.com",
            passwordHash: "x",
            plan: id === PRO_ID ? "PRO" : "BASICO",
            createdAt: "2026-11-08T00:00:00.000Z",
          }
        : null,
  }),
);

// Simula lo que hará la US25: resultados con calificación.
const rated = (rating: string) => {
  const result = new SimulationResult(
    1,
    "Entidad",
    new Decimal("0.05"),
    new Decimal("50.00"),
    null,
    new ServiceChannels(true, true),
  );
  result.riskRating = rating;
  return result;
};

const ratings = (results: SimulationResult[]) => results.map((r) => r.riskRating);

describe("RiskRatingFilter", () => {
  it("usuario Básico: todas las calificaciones quedan en null", () => {
    expect(ratings(filter.apply([rated("A+"), rated("B-")], BASIC_ID))).toEqual([null, null]);
  });

  it("usuario Pro: las calificaciones quedan intactas", () => {
    expect(ratings(filter.apply([rated("A+"), rated("B-")], PRO_ID))).toEqual(["A+", "B-"]);
  });

  it("sin sesión (userId undefined): se trata como no Pro", () => {
    expect(ratings(filter.apply([rated("A+")], undefined))).toEqual([null]);
  });

  it("usuario inexistente: se trata como no Pro", () => {
    expect(ratings(filter.apply([rated("A+")], 999))).toEqual([null]);
  });

  it("lista vacía", () => {
    expect(filter.apply([], BASIC_ID)).toEqual([]);
  });
});

describe("SimulationResult", () => {
  it("riskRating empieza en null (la US25 lo llenará)", () => {
    expect(new SimulationResult(1, "E", new Decimal(0), new Decimal(0), null, new ServiceChannels(true, true)).riskRating).toBeNull();
  });

  it("hideRiskRating() deja riskRating en null", () => {
    const result = rated("A+");
    result.hideRiskRating();
    expect(result.riskRating).toBeNull();
  });
});
