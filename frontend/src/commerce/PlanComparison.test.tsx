import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlanComparison } from "./PlanComparison";

const catalog = {
  plans: [
    { id: "BASICO", name: "Básico", price: null, features: { favorites: false } },
    { id: "PRO", name: "Pro", price: null, features: { favorites: true } },
  ],
  features: [{ id: "favorites", label: "Guardar simulaciones favoritas" }],
};

describe("US31, comparación de planes", () => {
  it("consulta el catálogo, muestra beneficios y conduce al checkout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(catalog)));
    vi.stubGlobal("fetch", fetchMock);
    const checkout = vi.fn();
    render(<PlanComparison onCheckout={checkout} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando planes");
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Básico" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Pro" })).toBeInTheDocument();
    expect(screen.getByText("Requiere Pro")).toBeInTheDocument();
    expect(screen.getByText("Incluido")).toBeInTheDocument();
    expect(screen.getAllByText("Precio pendiente de definición")).toHaveLength(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/plans");
    await userEvent.click(screen.getByRole("button", { name: "Continuar al checkout Pro" }));
    expect(checkout).toHaveBeenCalledOnce();
  });

  it("muestra la ausencia de planes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ plans: [], features: [] }))));
    render(<PlanComparison onCheckout={vi.fn()} />);
    expect(await screen.findByText("No hay planes disponibles por el momento.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continuar al checkout Pro" })).not.toBeInTheDocument();
  });

  it.each(["network", "http", "invalid"])("muestra el error %s y recupera el catálogo al reintentar", async (failure) => {
    const fetchMock = vi.fn();
    if (failure === "network") fetchMock.mockRejectedValueOnce(new TypeError("network"));
    else fetchMock.mockResolvedValueOnce(new Response(failure === "http" ? "{}" : "null", { status: failure === "http" ? 500 : 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(catalog)));
    vi.stubGlobal("fetch", fetchMock);
    render(<PlanComparison onCheckout={vi.fn()} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});
