import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

it("combina FSD, consulta contextual, semáforo y favoritos con el acceso a planes y checkout", async () => {
  localStorage.setItem("yupay.auth.session", JSON.stringify({ id: "test-session", userId: 17,
    tokenJwt: "test-bearer", plan: "BASICO", expiresAt: new Date(Date.now() + 60_000).toISOString() }));
  const fetchMock = vi.fn<typeof fetch>(async input => {
    const url = String(input);
    if (url.endsWith("/api/perfil")) return Response.json({ id: "usuario-demo", nombre: "Perfil demo", correo: "demo@example.com" });
    if (url.includes("/api/ahorros/")) return Response.json({ resultados: [{ cuentaId: "A",
      capitalInicial: "1,000.00", interesGenerado: "50.00", saldoFinal: "1,050.00", fechaApertura: "01/01/2024",
      monthlyMaintenanceFee: "0.00", channels: { hasPhysicalBranches: true, hasAtms: true } }] });
    if (url.endsWith("/api/favorites")) return Response.json({ code: "PRO_REQUIRED" }, { status: 403 });
    if (url.endsWith("/api/plans")) return Response.json({
      plans: [{ id: "PRO", name: "Pro", price: null, features: { favorites: true } }],
      features: [{ id: "favorites", label: "Guardar simulaciones favoritas" }],
    });
    if (url.endsWith("/api/checkout/config")) return Response.json({ environment: "DEMO", provider: "LOCAL_MOCK",
      simulation: true, cardCaptureAvailable: true, processingAvailable: true,
      realPaymentsAvailable: false, membershipActivationAvailable: false });
    throw new Error(`Petición inesperada: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  const table = await screen.findByRole("table");
  expect(await screen.findByLabelText("Nombre de usuario")).toHaveValue("Perfil demo");
  expect(within(table).getByRole("columnheader", { name: "Favoritos Pro" })).toBeInTheDocument();
  expect(within(table).getByText("Cobertura FSD no verificada")).toBeInTheDocument();
  const queryFsd = within(table).getByRole("button", { name: "Consultar FSD" });
  await userEvent.click(queryFsd);
  expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "FSD" })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(queryFsd).toHaveFocus();
  await userEvent.click(within(table).getByRole("button", { name: /Sin clasificar/ }));
  expect(table.querySelector(".fila-panel-riesgo td")).toHaveAttribute("colspan", String(within(table).getAllByRole("columnheader").length));
  await userEvent.click(within(table).getByRole("button", { name: "Guardar favorito de A" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Plan Pro");
  const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/favorites"));
  expect(new Headers(request?.[1]?.headers).get("Authorization")).toBe("Bearer test-bearer");
  expect(JSON.parse(String(request?.[1]?.body))).toEqual({ instrument: "AHORROS", accountId: "A", days: 365 });
  await userEvent.click(screen.getByRole("button", { name: "Comparar planes" }));
  expect(await screen.findByRole("heading", { name: "Compara los planes" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Continuar al checkout Pro" }));
  expect(await screen.findByLabelText("Nombre o razón social")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/checkout");
  await userEvent.click(screen.getByRole("link", { name: "Inicio" }));
  await screen.findByRole("table");
  expect(screen.getByRole("button", { name: "Consultar FSD" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar favorito de A" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Glosario financiero" }));
  expect(screen.getByRole("searchbox", { name: "Buscar término" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("yupay.auth.session")!).plan).toBe("BASICO");
});
