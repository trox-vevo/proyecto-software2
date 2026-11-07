import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IndicadorFSD } from "./IndicadorFSD";
import type { CoberturaFSD } from "./IndicadorFSD";

const cobertura: CoberturaFSD = { estado: "CUBIERTO", entidadFinanciera: "Entidad de prueba", fechaVerificacion: new Date().toISOString().slice(0, 10), vigenteHasta: new Date(Date.now() + 86400000).toISOString().slice(0, 10), fuente: "https://www.fsd.org.pe/" };
describe("Indicador FSD", () => {
  it("muestra cobertura confirmada, fuente y límites sin depender solo del color", () => {
    render(<IndicadorFSD cobertura={cobertura} />);
    expect(screen.getByText("Con cobertura FSD")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", cobertura.fuente);
    expect(screen.getByText(/Sujeto a los límites/)).toBeInTheDocument();
  });
  it("distingue ausencia de cobertura verificada", () => {
    render(<IndicadorFSD cobertura={{ ...cobertura, estado: "NO_CUBIERTO" }} />);
    expect(screen.getByText("Sin cobertura FSD")).toBeInTheDocument();
  });
  it.each([undefined, { ...cobertura, fuente: null }, { ...cobertura, entidadFinanciera: {} }, { ...cobertura, fechaVerificacion: 20261103 }, { ...cobertura, fuente: "javascript:alert(1)" }, { ...cobertura, vigenteHasta: "2020-01-01" }, { ...cobertura, estado: "OTRO" }])("muestra no verificado si falta evidencia fiable: %j", (raw) => {
    render(<IndicadorFSD cobertura={raw as CoberturaFSD | undefined} />);
    expect(screen.getByText("Cobertura FSD no verificada")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
