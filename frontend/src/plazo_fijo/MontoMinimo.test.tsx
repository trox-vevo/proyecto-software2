import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlazoFijoView } from "./PlazoFijoView";

const MENSAJE = "El monto mínimo requerido para apertura una cuenta es de S/ 500.00";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
function simularCon(monto: string) {
  fireEvent.change(screen.getByLabelText(/Monto de inversión/), { target: { value: monto } });
  fireEvent.submit(screen.getByRole("form"));
}

describe("Restricción de monto mínimo · US07 (TS-24)", () => {
  it("con 499.99 intercepta la acción, no consulta al backend y advierte junto al monto", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PlazoFijoView />);
    simularCon("499.99");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(MENSAJE);
    expect(screen.getByLabelText(/Monto de inversión/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Calculando resultados…")).not.toBeInTheDocument();
  });

  it.each(["500", "500.00", "500.01"])("con %s sí consulta al backend", async (monto) => {
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<PlazoFijoView />);
    simularCon(monto);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.queryByText(MENSAJE)).not.toBeInTheDocument();
  });

  it("al corregir el monto desaparece la advertencia", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<PlazoFijoView />);
    simularCon("100");
    expect(screen.getByRole("alert")).toHaveTextContent(MENSAJE);
    fireEvent.change(screen.getByLabelText(/Monto de inversión/), { target: { value: "600" } });
    expect(screen.queryByText(MENSAJE)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Monto de inversión/)).toHaveAttribute("aria-invalid", "false");
  });
});
