import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { COLUMNAS } from "./columnas";

// Arreglos 2 y 4: búsqueda de ahorros con monto y departamento, columnas nuevas y riesgo del backend.
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState(null, "", "/"); });

const fila = (cuentaId: string, extra: Record<string, unknown> = {}) => ({
  cuentaId, entityName: `Entidad ${cuentaId}`, capitalInicial: "1,000.00", interesGenerado: "50.00", saldoFinal: "1,050.00",
  fechaApertura: "01/01/2024", monthlyMaintenanceFee: "0.00", channels: { hasPhysicalBranches: true, hasAtms: true }, ...extra,
});

function mockAhorros(filas: unknown[]) {
  return vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
    String(input).includes("/api/ahorros/") ? { resultados: filas } : {},
  )));
}

describe("Búsqueda de ahorros (US08/US09/US13)", () => {
  it("al abrir lista todas las cuentas y al buscar envía monto y departamento", async () => {
    const fetchMock = mockAhorros([fila("AH-001", { tasaAnual: "0.05", montoMinimo: "500.00" })]);
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState(null, "", "/simular/ahorros");
    render(<App />);
    await screen.findByRole("table");
    expect(screen.getByText(/Mostrando todas las cuentas/)).toBeInTheDocument();
    const primera = String(fetchMock.mock.calls.find(([url]) => String(url).includes("/api/ahorros/"))![0]);
    expect(primera).not.toContain("monto=");

    await userEvent.type(screen.getByLabelText("Monto total a invertir (S/)"), "1500.50");
    await userEvent.selectOptions(screen.getByLabelText("Departamento de residencia"), "Cusco");
    await userEvent.click(screen.getByRole("button", { name: "Buscar cuentas" }));

    expect(await screen.findByText("Simulación de S/ 1,500.50 a 365 días en Cusco.")).toBeInTheDocument();
    const urls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/api/ahorros/"));
    const ultima = new URL(urls[urls.length - 1]);
    // jsdom normaliza el input number ("1500.5"); el backend acepta ambos formatos.
    expect(ultima.searchParams.get("monto")).toMatch(/^1500\.50?$/);
    expect(ultima.searchParams.get("departamento")).toBe("Cusco");
    expect(ultima.searchParams.get("dias")).toBe("365");
  });

  it("muestra la tasa y el monto mínimo con su formato", async () => {
    vi.stubGlobal("fetch", mockAhorros([
      fila("AH-001", { tasaAnual: "0.05", montoMinimo: "500.00" }),
      fila("AH-002", { tasaAnual: "0.1", montoMinimo: "0.00" }),
      fila("AH-003"),
    ]));
    window.history.pushState(null, "", "/simular/ahorros");
    render(<App />);
    const tabla = await screen.findByRole("table");
    const celdas = (cuenta: string) => within(within(tabla).getByRole("cell", { name: cuenta }).closest("tr")!).getAllByRole("cell").map((c) => c.textContent);
    expect(celdas("AH-001")).toEqual(expect.arrayContaining(["5.00 %", "S/ 500.00"]));
    expect(celdas("AH-002")).toEqual(expect.arrayContaining(["10.00 %", "Sin mínimo"]));
    expect(celdas("AH-003").filter((texto) => texto === "—").length).toBeGreaterThanOrEqual(2);
  });

  it("usa el riesgo que envía el backend en vez del mock (US22/US23)", async () => {
    vi.stubGlobal("fetch", mockAhorros([fila("AH-003", { riesgo: { nivel: "VERDE" } })]));
    window.history.pushState(null, "", "/simular/ahorros");
    render(<App />);
    const tabla = await screen.findByRole("table");
    const celda = within(tabla).getByRole("cell", { name: "AH-003" }).closest("tr")!;
    // En el mock AH-003 es ROJO; el backend manda VERDE y debe ganar.
    expect(celda.textContent).toMatch(/Bajo/i);
    expect(celda.textContent).not.toMatch(/Alto/i);
  });

  it("las columnas nuevas no alteran las existentes", () => {
    expect(COLUMNAS.map((c) => c.titulo)).toEqual([
      "Cuenta", "Entidad financiera", "Tasa anual (TEA)", "Monto mínimo", "Capital inicial", "Interés generado",
      "Saldo final", "Fecha de apertura", "Riesgo", "Cobertura FSD", "Costo de mantenimiento",
    ]);
  });
});
