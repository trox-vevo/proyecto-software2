import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import type { FilaAhorro } from "./tabla_ahorros/tipos";

// Datos propios de la prueba, no los de data/cuentas.json
const fila = (cuentaId: string, hasDigitalBanking: boolean, hasMobileApp: boolean): FilaAhorro => ({
  cuentaId,
  capitalInicial: "1,000.00",
  interesGenerado: "50.00",
  saldoFinal: "1,050.00",
  fechaApertura: "10/01/2023",
  monthlyMaintenanceFee: "0.00",
  channels: { hasPhysicalBranches: true, hasAtms: true },
  digitalChannels: { hasDigitalBanking, hasMobileApp },
});
const FILAS = [fila("A", true, true), fila("B", true, false), fila("C", false, true), fila("D", false, false)];

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

describe("Filtros de accesibilidad digital en la tabla de ahorros (US19)", () => {
  it("'Solo con banca digital' refiltra al instante, sin nueva petición HTTP", async () => {
    const fetchMock = renderAppWith(FILAS);
    await screen.findByText("Mostrando 4 de 4 opciones");

    await userEvent.click(screen.getByLabelText("Solo con banca digital"));

    expect(screen.getByText("Mostrando 2 de 4 opciones")).toBeInTheDocument();
    expect(visibleIds()).toEqual(["A", "B"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("'Con app móvil' + 'Solo con banca digital' combina con AND", async () => {
    renderAppWith(FILAS);
    await screen.findByText("Mostrando 4 de 4 opciones");

    await userEvent.click(screen.getByLabelText("Con app móvil"));
    expect(visibleIds()).toEqual(["A", "C"]);

    await userEvent.click(screen.getByLabelText("Solo con banca digital"));
    expect(visibleIds()).toEqual(["A"]);
  });

  it("cada fila muestra los íconos de sus canales digitales", async () => {
    renderAppWith(FILAS);
    await screen.findByText("Mostrando 4 de 4 opciones");

    expect(screen.getByRole("columnheader", { name: "Canales digitales" })).toBeInTheDocument();
    const filaB = screen.getAllByRole("row").find((row) => within(row).queryByText("B"))!;
    expect(within(filaB).getByRole("img", { name: "Banca digital: sí. App móvil: no." })).toBeInTheDocument();
  });

  it("si ninguna entidad tiene el canal, muestra el zero-state", async () => {
    renderAppWith([fila("D", false, false)]);
    await screen.findByText("Mostrando 1 de 1 opciones");

    await userEvent.click(screen.getByLabelText("Con app móvil"));

    expect(screen.getByText("Mostrando 0 de 1 opciones")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
