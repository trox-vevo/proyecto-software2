import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

it("abre Mis favoritos y re-simula la cuenta y los días guardados", async () => {
  const favorite = {
    id: 12,
    parameters: { instrument: "AHORROS", accountId: "AH-001", days: 180 },
    snapshot: { cuentaId: "AH-001", capitalInicial: "1,000.00" },
    createdAt: "2026-11-14T12:00:00.000Z",
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/perfil")) return Response.json({ id: "demo", nombre: "Usuario", correo: "demo@example.com" });
    if (url.endsWith("/api/favorites")) return Response.json({ favorites: [favorite] });
    if (url.includes("/api/ahorros/")) return Response.json({ resultados: [{
      cuentaId: "AH-001", capitalInicial: "1,000.00", interesGenerado: "25.00",
      saldoFinal: "1,025.00", fechaApertura: "01/01/2024", monthlyMaintenanceFee: "0.00",
      channels: { hasPhysicalBranches: true, hasAtms: true },
    }] });
    return Response.json({ plans: [], features: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);

  await userEvent.click(screen.getByRole("link", { name: "Mis favoritos" }));
  expect(window.location.pathname).toBe("/favoritos");
  expect(await screen.findByRole("heading", { name: "Mis Simulaciones Guardadas" })).toBeInTheDocument();
  await userEvent.click(await screen.findByRole("button", { name: "Volver a simular" }));
  expect(window.location.pathname).toBe("/");
  await waitFor(() => {
    const requests = fetchMock.mock.calls.map(([url]) => new URL(String(url)));
    expect(requests.some((url) => url.pathname.endsWith("/api/ahorros/rentabilidad") &&
      url.searchParams.get("dias") === "180" && url.searchParams.get("accountId") === "AH-001")).toBe(true);
  });
});
