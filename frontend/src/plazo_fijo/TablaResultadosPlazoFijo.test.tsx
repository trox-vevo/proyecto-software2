import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TablaResultadosPlazoFijo } from "./TablaResultadosPlazoFijo";
import { formatearImporte, formatearTasa } from "./formato";
import type { ResultadoPlazoFijo } from "./tipos";

const resultado: ResultadoPlazoFijo = {
  productId: 2, entityName: "Entidad de prueba", tea: "0.0575",
  totalInterest: "56.04", monthlyInterest: "4.67", minimumAmount: "1000.00",
};

describe("TablaResultadosPlazoFijo · US12", () => {
  it("muestra entidades e importes recibidos y los encabezados estándar", () => {
    render(<TablaResultadosPlazoFijo resultados={[resultado]} modalidad="AT_MATURITY" />);
    expect(screen.getAllByRole("columnheader").map((celda) => celda.textContent)).toEqual([
      "Entidad", "Tasa (TEA)", "Intereses Totales", "Monto Mínimo de Cuenta",
    ]);
    for (const valor of ["Entidad de prueba", "5.75 %", "S/ 56.04", "S/ 1,000.00"]) {
      expect(screen.getByRole("cell", { name: valor })).toBeInTheDocument();
    }
    expect(screen.queryByText("S/ 4.67")).not.toBeInTheDocument();
  });

  it("agrega y retira la columna mensual al cambiar de modalidad", () => {
    const { rerender } = render(<TablaResultadosPlazoFijo resultados={[resultado]} modalidad="MONTHLY" />);
    expect(screen.getByRole("columnheader", { name: "Intereses Mensuales (Aproximado)" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "S/ 4.67" })).toBeInTheDocument();
    rerender(<TablaResultadosPlazoFijo resultados={[resultado]} modalidad="AT_MATURITY" />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(4);
    expect(screen.queryByText("Intereses Mensuales (Aproximado)")).not.toBeInTheDocument();
    rerender(<TablaResultadosPlazoFijo resultados={[resultado]} modalidad="MONTHLY" />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  });

  it("no inventa un interés mensual cuando llega null", () => {
    render(<TablaResultadosPlazoFijo resultados={[{ ...resultado, monthlyInterest: null }]} modalidad="MONTHLY" />);
    expect(screen.getByRole("cell", { name: "—" })).toBeInTheDocument();
  });

  it("con un arreglo vacío muestra el zero-state de US13 (TS-37)", () => {
    render(<TablaResultadosPlazoFijo resultados={[]} modalidad="MONTHLY" />);
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultados");
    expect(screen.getByRole("status")).toHaveTextContent(
      "No encontramos opciones para esta configuración. Intenta cambiar a otros parámetros");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("conserva centavos por encima de Number.MAX_SAFE_INTEGER y solo presenta la tasa", () => {
    expect(formatearImporte("9007199254740993.25")).toBe("S/ 9,007,199,254,740,993.25");
    expect(formatearImporte("0.00")).toBe("S/ 0.00");
    expect(formatearTasa("0.0575")).toBe("5.75 %");
    expect(formatearTasa("0.000123456789123456789")).toBe("0.0123456789123456789 %");
    expect(formatearTasa("1e-7")).toBe("0.00001 %");
  });
});
