import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import type { FilaAhorro } from "./tabla_ahorros/tipos";

// Datos propios de la prueba (entidades A–E de CLAUDE.md §7), no los de data/cuentas.json
const fila = (cuentaId: string, monthlyMaintenanceFee: string, hasPhysicalBranches: boolean, hasAtms: boolean): FilaAhorro => ({
  cuentaId,
  capitalInicial: "1,000.00",
  interesGenerado: "50.00",
  saldoFinal: "1,050.00",
  fechaApertura: "10/01/2023",
  monthlyMaintenanceFee,
  channels: { hasPhysicalBranches, hasAtms },
});
const LIMA = [
  fila("A", "0.00", true, true),
  fila("B", "0.00", true, false),
  fila("C", "5.00", false, true),
  fila("D", "0.00", false, false),
  fila("E", "8.50", true, true),
];

function renderAppWith(filas: FilaAhorro[]) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ resultados: filas })));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  return fetchMock;
}

const visibleIds = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1) // sin la cabecera
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("Filtros de resultados en la tabla de ahorros (US17/US18)", () => {
  it("marcar 'Sin costo de mantenimiento' pasa el contador de 5 de 5 a 3 de 5", async () => {
    renderAppWith(LIMA);
    expect(await screen.findByText("Mostrando 5 de 5 opciones")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Sin costo de mantenimiento"));

    expect(screen.getByText("Mostrando 3 de 5 opciones")).toBeInTheDocument();
    expect(visibleIds()).toEqual(["A", "B", "D"]);
  });

  it("agencias + cajeros combina con AND; desmarcar vuelve atrás SIN nueva petición HTTP", async () => {
    const fetchMock = renderAppWith(LIMA);
    await screen.findByText("Mostrando 5 de 5 opciones");

    await userEvent.click(screen.getByLabelText("Con agencias físicas"));
    await userEvent.click(screen.getByLabelText("Con cajeros disponibles"));
    expect(screen.getByText("Mostrando 2 de 5 opciones")).toBeInTheDocument();
    expect(visibleIds()).toEqual(["A", "E"]);

    await userEvent.click(screen.getByLabelText("Con agencias físicas"));
    await userEvent.click(screen.getByLabelText("Con cajeros disponibles"));
    expect(screen.getByText("Mostrando 5 de 5 opciones")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si el filtro deja 0 resultados, muestra el zero-state de la tabla", async () => {
    renderAppWith([fila("F", "3.00", true, false)]);
    await screen.findByText("Mostrando 1 de 1 opciones");

    await userEvent.click(screen.getByLabelText("Sin costo de mantenimiento"));

    expect(screen.getByText("Mostrando 0 de 1 opciones")).toBeInTheDocument();
    expect(screen.getByText("No hay cuentas que mostrar.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("columna 'Costo de mantenimiento': 'Sin costo' si es 0 y 'S/ x.xx' en otro caso", async () => {
    renderAppWith(LIMA);
    await screen.findByText("Mostrando 5 de 5 opciones");

    expect(screen.getByRole("columnheader", { name: "Costo de mantenimiento" })).toBeInTheDocument();
    expect(screen.getAllByText("Sin costo")).toHaveLength(3);
    expect(screen.getByText("S/ 5.00")).toBeInTheDocument();
    expect(screen.getByText("S/ 8.50")).toBeInTheDocument();
  });
});
