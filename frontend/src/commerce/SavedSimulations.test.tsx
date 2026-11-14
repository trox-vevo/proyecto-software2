import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SavedSimulations } from "./SavedSimulations";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const favorite = {
  id: 8,
  parameters: { instrument: "AHORROS" as const, accountId: "AH-001", days: 180 },
  snapshot: { nombreCuenta: "Ahorro Seguro", capitalInicial: "1,000.00" },
  createdAt: "2026-11-14T12:00:00.000Z",
};

describe("US29, simulaciones guardadas", () => {
  it("muestra la tarjeta y entrega los parámetros originales para re-simular", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ favorites: [favorite] })));
    const onReplay = vi.fn();
    render(<SavedSimulations onReplay={onReplay} onViewPlans={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Ahorro Seguro" })).toBeInTheDocument();
    expect(screen.getByText("S/ 1,000.00")).toBeInTheDocument();
    expect(screen.getByText("180 días")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a simular" }));
    expect(onReplay).toHaveBeenCalledWith(favorite.parameters);
  });

  it("solicita confirmación antes de eliminar y retira la tarjeta al confirmar", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ favorites: [favorite] }))
      .mockResolvedValueOnce(Response.json({ deleted: true }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SavedSimulations onReplay={vi.fn()} onViewPlans={vi.fn()} />);

    await screen.findByRole("heading", { name: "Ahorro Seguro" });
    await userEvent.click(screen.getByRole("button", { name: "Eliminar favorito" }));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[1][1]?.method).toBe("DELETE");
    expect(await screen.findByRole("status")).toHaveTextContent("Simulación eliminada correctamente.");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Ahorro Seguro" })).not.toBeInTheDocument());
  });

  it("conserva la tarjeta cuando se cancela la eliminación", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ favorites: [favorite] }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<SavedSimulations onReplay={vi.fn()} onViewPlans={vi.fn()} />);

    await screen.findByRole("heading", { name: "Ahorro Seguro" });
    await userEvent.click(screen.getByRole("button", { name: "Eliminar favorito" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Ahorro Seguro" })).toBeInTheDocument();
  });
});
