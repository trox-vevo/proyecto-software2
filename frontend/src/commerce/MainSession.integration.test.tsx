import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "../App";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

it("usa la sesión de main para favoritos y desmonta checkout al navegar a registro", async () => {
  window.history.replaceState(null, "", "/login");
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.endsWith("/api/auth/login")) return Response.json({ plan: "PRO", session: {
      id: "session-test", userId: 7, tokenJwt: "jwt-signed-test", plan: "PRO",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    } });
    if (url.endsWith("/api/perfil")) return Response.json({ id: "usuario-demo", nombre: "Perfil demo", correo: "demo@example.com" });
    if (url.includes("/api/ahorros/")) return Response.json({ resultados: [{ cuentaId: "A", capitalInicial: "1,000.00",
      interesGenerado: "50.00", saldoFinal: "1,050.00", fechaApertura: "01/01/2024", monthlyMaintenanceFee: "0.00",
      channels: { hasPhysicalBranches: true, hasAtms: true } }] });
    if (url.endsWith("/api/favorites")) return Response.json({ favorite: { id: 2 }, created: true }, { status: 201 });
    if (url.endsWith("/api/plans")) return Response.json({
      plans: [{ id: "PRO", name: "Pro", price: null, features: { favorites: true } }],
      features: [{ id: "favorites", label: "Guardar simulaciones favoritas" }],
    });
    if (url.endsWith("/api/checkout/config")) return Response.json({ environment: "DEMO", provider: "LOCAL_MOCK",
      simulation: true, cardCaptureAvailable: true, processingAvailable: true,
      realPaymentsAvailable: false, membershipActivationAvailable: true });
    throw new Error(`Petición inesperada: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  expect(fetchMock).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText("Correo electrónico"), "pro@example.com");
  await userEvent.type(screen.getByLabelText("Contraseña"), "Clave-segura-123");
  await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
  await screen.findByRole("table");
  expect(await screen.findByLabelText("Nombre de usuario")).toHaveValue("Perfil demo");
  await userEvent.click(screen.getByRole("button", { name: "Guardar favorito de A" }));
  expect(await screen.findByText("Simulación guardada como favorita.")).toBeInTheDocument();
  const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/favorites"));
  expect(new Headers(request?.[1]?.headers).get("Authorization")).toBe("Bearer jwt-signed-test");
  expect(JSON.parse(String(request?.[1]?.body))).toEqual({ instrument: "AHORROS", accountId: "A", days: 365 });
  await userEvent.click(screen.getByRole("link", { name: "Planes" }));
  await screen.findByRole("button", { name: "Continuar al checkout Pro" });
  await userEvent.click(screen.getByRole("button", { name: "Continuar al checkout Pro" }));
  await screen.findByLabelText("Nombre del titular");
  await userEvent.type(screen.getByLabelText("Nombre del titular"), "Titular ficticio");
  await userEvent.type(screen.getByLabelText("Número de tarjeta"), "0000111122223333");
  await userEvent.type(screen.getByLabelText("CVV"), "456");
  await userEvent.click(screen.getByRole("link", { name: "Crear cuenta" }));
  expect(window.location.pathname).toBe("/registro");
  expect(screen.queryByLabelText("CVV")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("link", { name: "Volver al inicio" }));
  await screen.findByRole("table");
  expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("link", { name: "Planes" }));
  await screen.findByRole("button", { name: "Continuar al checkout Pro" });
  await userEvent.click(screen.getByRole("button", { name: "Continuar al checkout Pro" }));
  expect(await screen.findByLabelText("Nombre del titular")).toHaveValue("");
  expect(screen.getByLabelText("Número de tarjeta")).toHaveValue("");
  expect(screen.getByLabelText("CVV")).toHaveValue("");
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/checkout/simulate"))).toBe(false);
});
