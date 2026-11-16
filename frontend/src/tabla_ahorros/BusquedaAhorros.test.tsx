import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { SimuladorPage } from "../pages/SimuladorPage";
import { buscarAhorros } from "../test/buscarAhorros";
import type { FilaAhorro } from "./tipos";

// US05/US08/US09/US11: búsqueda de ahorros por monto y departamento. Datos propios de la prueba.
afterEach(() => { localStorage.clear(); window.history.replaceState(null, "", "/"); });

const fila = (cuentaId: string, entidad: string, tasaAnual: string, interesGenerado: string, montoMinimo: string | null): FilaAhorro => ({
  cuentaId, entidad, tasaAnual, montoMinimo, interesGenerado,
  capitalInicial: "1,000.00", saldoFinal: "1,100.00", fechaApertura: "01/01/2024", monthlyMaintenanceFee: "0.00",
  channels: { hasPhysicalBranches: true, hasAtms: true }, digitalChannels: { hasDigitalBanking: true, hasMobileApp: true },
});
const LIMA = [
  fila("AH-003", "Interbank", "0.1", "100.00", "1,000.00"),
  fila("AH-001", "BCP", "0.05", "50.00", "0.00"),
];

const llamadasAhorros = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/ahorros/rentabilidad"));

function abrirSimulador(responder: () => Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).includes("/api/ahorros/")
    ? responder()
    : Response.json({ id: "usuario-demo", nombre: "Usuario demo", correo: "demo@example.com" }));
  vi.stubGlobal("fetch", fetchMock);
  window.history.pushState(null, "", "/simular/ahorros");
  render(<App />);
  return fetchMock;
}

describe("Búsqueda de ahorros por monto y departamento", () => {
  it("al abrir el simulador no consulta ahorros y pide ingresar los datos", async () => {
    const fetchMock = abrirSimulador(async () => Response.json({ resultados: LIMA }));
    expect(await screen.findByText("Ingresa el monto y tu departamento, y presiona Buscar para ver las opciones.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(llamadasAhorros(fetchMock)).toHaveLength(0);
  });

  it("al presionar Buscar muestra la carga y envía monto y departamento una sola vez", async () => {
    let responder: (respuesta: Response) => void = () => {};
    const fetchMock = abrirSimulador(() => new Promise<Response>((resolve) => { responder = resolve; }));
    await buscarAhorros("1000", "Lima");

    expect(screen.getByText("Cargando resultados…")).toBeInTheDocument();
    const llamadas = llamadasAhorros(fetchMock);
    expect(llamadas).toHaveLength(1);
    const url = new URL(String(llamadas[0][0]));
    expect(url.searchParams.get("monto")).toBe("1000");
    expect(url.searchParams.get("departamento")).toBe("Lima");
    expect(url.searchParams.get("dias")).toBe("365");

    responder(Response.json({ resultados: LIMA }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("muestra las columnas de la US11 y la entidad de mayor interés primero", async () => {
    abrirSimulador(async () => Response.json({ resultados: LIMA }));
    await buscarAhorros();
    const tabla = await screen.findByRole("table");

    const titulos = within(tabla).getAllByRole("columnheader").map((celda) => celda.getAttribute("aria-label") ?? celda.textContent);
    expect(titulos.slice(0, 8)).toEqual([
      "Entidad", "Tasa (TEA)", "Interés proyectado (1 año)", "Saldo final", "Monto mínimo", "Riesgo", "Cobertura FSD", "Costo de mantenimiento",
    ]);
    const primera = within(tabla).getAllByRole("row")[1];
    expect(within(primera).getByText("Interbank")).toBeInTheDocument();
    expect(within(primera).getByText("10.00 %")).toBeInTheDocument();
    expect(within(primera).getByText("100.00")).toBeInTheDocument();
    expect(within(primera).getByText("S/ 1,000.00")).toBeInTheDocument();
  });

  it("sin entidades que coincidan muestra el zero-state de la US13", async () => {
    abrirSimulador(async () => Response.json({ resultados: [] }));
    await buscarAhorros("1000", "Arequipa");
    expect(await screen.findByText("No encontramos opciones para esta configuración. Intenta cambiar a otros parámetros")).toBeInTheDocument();
  });

  it("ante un 400 muestra el mensaje en español y permite reintentar, sin errores técnicos", async () => {
    abrirSimulador(async () => Response.json({ error: "Para buscar, envía monto y departamento." }, { status: 400 }));
    await buscarAhorros();
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Para buscar, envía monto y departamento.");
    expect(alerta).not.toHaveTextContent(/TypeError|undefined|stack|500/);
    expect(within(alerta).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("US29: con un favorito que repetir, la tabla carga sin presionar Buscar", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () => Response.json({ resultados: [LIMA[1]] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<SimuladorPage instrumento="AHORROS" savingsReplay={{ accountId: "AH-001", days: 180 }} />);

    expect(await screen.findByRole("table")).toBeInTheDocument();
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("accountId")).toBe("AH-001");
    expect(url.searchParams.get("dias")).toBe("180");
    expect(url.searchParams.has("monto")).toBe(false);
  });
});
