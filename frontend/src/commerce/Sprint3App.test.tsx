import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { navegar } from "../app/navegacion";

afterEach(() => window.history.replaceState(null, "", "/"));
const catalog = {
  plans: [{ id: "PRO", name: "Pro", price: "9.90", billingPeriod: "MONTHLY", features: { favorites: true } }],
  features: [{ id: "favorites", label: "Guardar simulaciones favoritas" }],
};

function setup() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/api/perfil")) return Response.json({ id: "usuario-demo", nombre: "Usuario demo", correo: "demo@example.com" });
    if (url.endsWith("/api/plans")) return new Response(JSON.stringify(catalog));
    if (url.endsWith("/api/checkout/config")) return new Response(JSON.stringify({ environment: "DEMO", provider: "LOCAL_MOCK", simulation: true, cardCaptureAvailable: true, processingAvailable: true, realPaymentsAvailable: false, membershipActivationAvailable: true, price: "9.90", currency: "PEN", billingPeriod: "MONTHLY" }));
    if (url.endsWith("/api/checkout/history")) return Response.json({ transactions: [] });
    if (url.endsWith("/api/favorites")) return new Response("{}", { status: 403 });
    return new Response(JSON.stringify({ resultados: [{ cuentaId: "A", capitalInicial: "1,000.00", interesGenerado: "50.00", saldoFinal: "1,050.00", fechaApertura: "01/01/2024", monthlyMaintenanceFee: "0.00", channels: { hasPhysicalBranches: true, hasAtms: true } }] }));
  });
  vi.stubGlobal("fetch", fetchMock);
  window.history.pushState(null, "", "/simular/ahorros");
  render(<App />);
  return fetchMock;
}

describe("Sprint 3 desde la navegación normal", () => {
  it("abre planes desde el inicio, llega al checkout y vuelve al simulador", async () => {
    setup();
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("link", { name: "Planes" }));
    await screen.findByRole("table");
    expect(window.location.pathname).toBe("/planes");
    await userEvent.click(screen.getByRole("button", { name: "Continuar al checkout Pro" }));
    expect(window.location.pathname).toBe("/checkout");
    await screen.findByLabelText("Nombre o razón social");
    await userEvent.click(screen.getByRole("button", { name: "Volver a planes" }));
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("link", { name: "Inicio" }));
    await userEvent.click(screen.getByRole("button", { name: "Simular ahorros" }));
    expect(screen.getByRole("heading", { name: "Configura tu inversión" })).toBeInTheDocument();
  });

  it("ofrece guardar desde la fila y conduce al paywall ante una cuenta Básica", async () => {
    const fetchMock = setup();
    const table = await screen.findByRole("table");
    await userEvent.click(within(table).getByRole("button", { name: "Guardar favorito de A" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Plan Pro");
    await userEvent.click(screen.getByRole("button", { name: "Comparar planes" }));
    expect(await screen.findByRole("heading", { name: "Compara los planes" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/api/favorites"))).toBe(true);
  });

  it("atiende la navegación del historial del navegador", async () => {
    setup();
    await screen.findByRole("table");
    act(() => { window.history.replaceState(null, "", "/planes"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(await screen.findByRole("heading", { name: "Compara los planes" })).toBeInTheDocument();
  });

  it("abre el historial de facturación desde los ajustes de la cuenta", async () => {
    const fetchMock = setup();
    await screen.findByRole("table");
    act(() => navegar("/perfil")); // sin sesión, la cabecera no muestra "Mi perfil"
    await screen.findByRole("heading", { name: "Mi perfil" });
    await userEvent.click(screen.getByRole("button", { name: "Historial de facturación" }));
    expect(await screen.findByRole("heading", { name: "Historial de facturación" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/facturacion");
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/api/checkout/history"))).toBe(true);
  });
});
