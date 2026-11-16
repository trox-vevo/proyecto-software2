import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TablaResultadosPlazoFijo } from "./TablaResultadosPlazoFijo";
import type { ParametrosPlazoFijo, ResultadoPlazoFijo } from "./tipos";

// US28 (arreglo 1): guardar un plazo fijo como favorito desde su tabla de resultados.
afterEach(() => vi.unstubAllGlobals());

const resultado: ResultadoPlazoFijo = {
  productId: 2, entityName: "BBVA Perú", tea: "0.0575",
  totalInterest: "56.04", monthlyInterest: null, minimumAmount: "1000.00", riskRating: null,
};
const parametros: ParametrosPlazoFijo = { amount: " 1500.50 ", department: "Lima", paymentMode: "AT_MATURITY", termDays: 360 };

describe("US28: favorito de plazo fijo", () => {
  it("sin parámetros la tabla no cambia (sin columna de favoritos)", () => {
    render(<TablaResultadosPlazoFijo resultados={[resultado]} modalidad="AT_MATURITY" />);
    expect(screen.queryByRole("columnheader", { name: "Favoritos Pro" })).not.toBeInTheDocument();
  });

  it("envía instrument PLAZO_FIJO con el producto y los parámetros de la simulación", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ favorite: { id: 9 }, created: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TablaResultadosPlazoFijo resultados={[resultado]} modalidad="AT_MATURITY" parametros={parametros} />);
    expect(screen.getByRole("columnheader", { name: "Favoritos Pro" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar favorito de BBVA Perú" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Simulación guardada como favorita.");
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/favorites");
    expect(JSON.parse(request.body)).toEqual({
      instrument: "PLAZO_FIJO", productId: 2, amount: "1500.50", termDays: 360, department: "Lima", paymentMode: "AT_MATURITY",
    });
  });

  it("un usuario Básico ve el aviso Pro y el botón para comparar planes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
    const planes = vi.fn();
    render(<TablaResultadosPlazoFijo resultados={[resultado]} modalidad="AT_MATURITY" parametros={parametros} onViewPlans={planes} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar favorito de BBVA Perú" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Guardar favoritos requiere el Plan Pro.");
    await userEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Comparar planes" }));
    expect(planes).toHaveBeenCalledOnce();
  });
});
