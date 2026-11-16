import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { navegar } from "../app/navegacion";
import type { CoberturaFSD } from "../fsd/IndicadorFSD";

afterEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/"); });

const perfil = { id: "usuario-demo", nombre: "Usuario de demostración", correo: "usuario@ejemplo.com" };
function savingsResponse(filas: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
    String(input).includes("/api/perfil") ? perfil : { resultados: filas },
  )));
}

describe("Integración de FSD y glosario en resultados", () => {
  it("muestra el estado seguro de datos anteriores y abre la definición desde la cabecera", async () => {
    const fetchMock = savingsResponse([{ cuentaId: "A", capitalInicial: "1,000.00", interesGenerado: "50.00", saldoFinal: "1,050.00", fechaApertura: "01/01/2024", monthlyMaintenanceFee: "0.00", channels: { hasPhysicalBranches: true, hasAtms: true } }]);
    vi.stubGlobal("fetch", fetchMock); window.history.pushState(null, "", "/simular/ahorros"); render(<App />);
    await screen.findByRole("table");
    expect(screen.getByLabelText("FSD: No verificado")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Consultar FSD" });
    await userEvent.click(button);
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "FSD" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}"); expect(button).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Consultar Interés" }));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Interés" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/ahorros/"))).toHaveLength(1);
    act(() => navegar("/perfil")); // sin sesión, la cabecera no muestra "Mi perfil"
    await screen.findByLabelText("Nombre de usuario");
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/perfil"))).toHaveLength(1);
    expect(screen.getByLabelText("Nombre de usuario")).toHaveValue(perfil.nombre);
  });
  it("integra los tres estados FSD en la tabla sin perder el atributo al filtrar", async () => {
    const evidencia: CoberturaFSD = {
      estado: "CUBIERTO", entidadFinanciera: "Entidad de prueba",
      fechaVerificacion: new Date().toISOString().slice(0, 10),
      vigenteHasta: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      fuente: "https://www.fsd.org.pe/",
    };
    const fila = (cuentaId: string, coberturaFSD?: CoberturaFSD) => ({
      cuentaId, capitalInicial: "1,000.00", interesGenerado: "50.00", saldoFinal: "1,050.00",
      fechaApertura: "01/01/2024", monthlyMaintenanceFee: cuentaId === "C" ? "5.00" : "0.00",
      channels: { hasPhysicalBranches: true, hasAtms: true }, coberturaFSD,
    });
    vi.stubGlobal("fetch", savingsResponse([
      fila("A", evidencia), fila("B", { ...evidencia, estado: "NO_CUBIERTO" }), fila("C"),
    ]));
    window.history.pushState(null, "", "/simular/ahorros");
    render(<App />);
    await screen.findByRole("table");
    expect(screen.getByLabelText("FSD: Verificado")).toBeInTheDocument();
    expect(screen.getByLabelText("FSD: No cubierto")).toBeInTheDocument();
    expect(screen.getByLabelText("FSD: No verificado")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Sin costo de mantenimiento"));
    expect(screen.getByText("Mostrando 2 de 3 opciones")).toBeInTheDocument();
    expect(screen.getByLabelText("FSD: Verificado")).toBeInTheDocument();
    expect(screen.getByLabelText("FSD: No cubierto")).toBeInTheDocument();
    expect(screen.queryByLabelText("FSD: No verificado")).not.toBeInTheDocument();
  });
  it("permite consultar el glosario desde la navegación general en ambos instrumentos", async () => {
    vi.stubGlobal("fetch", savingsResponse([]));
    window.history.pushState(null, "", "/simular/ahorros");
    render(<App />);
    await screen.findByRole("heading", { name: "Sin resultados" });
    await userEvent.click(screen.getByRole("button", { name: "Glosario financiero" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar glosario" }));
    await userEvent.click(screen.getByRole("radio", { name: "Depósito a Plazo Fijo" }));
    await userEvent.click(screen.getByRole("button", { name: "Glosario financiero" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "TEA" }));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "TEA" })).toBeInTheDocument();
  });
});
