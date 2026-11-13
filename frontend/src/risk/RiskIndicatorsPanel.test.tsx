import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { nivelDeCalificacion } from "./nivelDeCalificacion";
import { RiskIndicatorsPanel } from "./RiskIndicatorsPanel";
import type { SbsRiskProfile } from "./tipos";

// US25 (TS-80): el panel muestra la calificación con su color y los indicadores
const perfil = (riskRating: string): SbsRiskProfile => ({
  entityId: 1,
  entityName: "Entidad A",
  riskRating,
  capitalAdequacyRatio: "0.1620",
  delinquencyRate: "0.0210",
  liquidityRatio: "0.3150",
  reportDate: "2026-09-30",
  sourceUrl: "https://www.sbs.gob.pe/",
});

describe("nivelDeCalificacion", () => {
  it.each(["A+", "A"])("%s es verde", (rating) => {
    expect(nivelDeCalificacion(rating)).toBe("VERDE");
  });

  it.each(["A-", "B+", "B", "B-"])("%s es amarillo", (rating) => {
    expect(nivelDeCalificacion(rating)).toBe("AMARILLO");
  });

  it.each(["C+", "C", "D", "E-"])("%s es rojo", (rating) => {
    expect(nivelDeCalificacion(rating)).toBe("ROJO");
  });

  it.each(["", "AA", "F", "a+"])("'%s' no es una calificación: sin clasificar", (rating) => {
    expect(nivelDeCalificacion(rating)).toBeNull();
  });
});

describe("RiskIndicatorsPanel", () => {
  it("muestra la calificación con su etiqueta de riesgo", () => {
    render(<RiskIndicatorsPanel profile={perfil("A+")} />);

    const panel = screen.getByRole("region", { name: "Indicadores de riesgo de Entidad A" });
    expect(panel).toHaveTextContent("A+");
    expect(panel).toHaveTextContent("Riesgo bajo");
  });

  it.each([
    ["A-", "Riesgo medio"],
    ["C", "Riesgo alto"],
    ["X", "Sin clasificar"],
  ])("%s se muestra como '%s'", (rating, etiqueta) => {
    render(<RiskIndicatorsPanel profile={perfil(rating)} />);
    expect(screen.getByText(etiqueta)).toBeInTheDocument();
  });

  it("muestra los indicadores en porcentaje", () => {
    render(<RiskIndicatorsPanel profile={perfil("A")} />);

    expect(screen.getByText("Ratio de capital global").nextSibling).toHaveTextContent("16.20 %");
    expect(screen.getByText("Morosidad").nextSibling).toHaveTextContent("2.10 %");
    expect(screen.getByText("Liquidez").nextSibling).toHaveTextContent("31.50 %");
  });

  it("indica la fuente y la fecha de los datos", () => {
    render(<RiskIndicatorsPanel profile={perfil("A")} />);

    expect(screen.getByRole("link", { name: "SBS" })).toHaveAttribute("href", "https://www.sbs.gob.pe/");
    expect(screen.getByText(/datos al 30\/09\/2026/)).toBeInTheDocument();
  });
});
