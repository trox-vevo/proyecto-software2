import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

function mockApi() {
  const perfil = { id: "usuario-demo", nombre: "Usuario demo", correo: "demo@example.com" };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/perfil")) {
      if (init?.method === "PUT") Object.assign(perfil, JSON.parse(String(init.body)));
      return Response.json(perfil);
    }
    if (url.includes("/api/ahorros/")) return Response.json({ resultados: [{
      cuentaId: "A", capitalInicial: "1,000.00", interesGenerado: "50.00", saldoFinal: "1,050.00",
      fechaApertura: "01/01/2024", monthlyMaintenanceFee: "5.00",
      channels: { hasPhysicalBranches: true, hasAtms: true },
    }] });
    if (url.endsWith("/api/users/register")) return Response.json({ user: { id: 7 } }, { status: 201 });
    if (url.endsWith("/api/auth/login")) return Response.json({
      session: { id: "session-test", userId: 7, tokenJwt: "signed-test-token", plan: "BASICO",
        expiresAt: new Date(Date.now() + 60_000).toISOString() }, plan: "BASICO",
    });
    throw new Error(`Petición inesperada: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("mantiene edición de perfil, FSD, glosario contextual y zero-state al filtrar sin volver a consultar", async () => {
  const fetchMock = mockApi();
  render(<App />);
  await screen.findByRole("table");
  expect(screen.getByText("Cobertura FSD no verificada")).toBeInTheDocument();
  const nombre = await screen.findByLabelText("Nombre de usuario");
  await userEvent.clear(nombre);
  await userEvent.type(nombre, "Nombre actualizado");
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText("Perfil actualizado correctamente.")).toBeInTheDocument();
  const contextual = screen.getByRole("button", { name: "Consultar FSD" });
  await userEvent.click(contextual);
  expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "FSD" })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  expect(contextual).toHaveFocus();
  await userEvent.click(screen.getByLabelText("Sin costo de mantenimiento"));
  const empty = screen.getByRole("heading", { name: "Sin resultados" });
  expect(empty.closest('[role="status"]')).toHaveTextContent("Intenta cambiar a otros parámetros");
  expect(screen.getByText("Mostrando 0 de 1 opciones")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Glosario financiero" }));
  await userEvent.type(screen.getByRole("searchbox", { name: "Buscar término" }), "interes");
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Interés" })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByLabelText("Sin costo de mantenimiento"));
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByText("Cobertura FSD no verificada")).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/ahorros/"))).toHaveLength(1);
  expect(fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/perfil") && init?.method === "PUT")?.[1]?.body)
    .toBe(JSON.stringify({ nombre: "Nombre actualizado", correo: "demo@example.com" }));
});

it("navega registro → login → finanzas y conserva perfil, glosario y bearer token", async () => {
  window.history.replaceState(null, "", "/registro");
  const fetchMock = mockApi();
  render(<App />);
  expect(screen.queryByRole("heading", { name: "Mi perfil" })).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText("Nombre de usuario"), "Estudiante");
  await userEvent.type(screen.getByLabelText("Correo electrónico"), "estudiante@example.com");
  await userEvent.type(screen.getByLabelText("Contraseña", { exact: true }), "Clave-segura-123");
  await userEvent.type(screen.getByLabelText("Confirmar contraseña"), "Clave-segura-123");
  await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(await screen.findByText("Cuenta creada correctamente.")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/login");
  await userEvent.type(screen.getByLabelText("Correo electrónico"), "estudiante@example.com");
  await userEvent.type(screen.getByLabelText("Contraseña"), "Clave-segura-123");
  await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
  await screen.findByRole("table");
  expect(window.location.pathname).toBe("/");
  expect(await screen.findByLabelText("Nombre de usuario")).toHaveValue("Usuario demo");
  expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("yupay.auth.session")!).userId).toBe(7);
  for (const endpoint of ["/api/perfil", "/api/ahorros/"]) {
    const request = fetchMock.mock.calls.find(([url]) => String(url).includes(endpoint));
    expect(new Headers(request?.[1]?.headers).get("Authorization")).toBe("Bearer signed-test-token");
  }
  await userEvent.click(screen.getByRole("button", { name: "Glosario financiero" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  expect(localStorage.getItem("yupay.auth.session")).toBeNull();
  expect(window.location.pathname).toBe("/login");
  expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("link", { name: "Volver al inicio" }));
  await screen.findByRole("table");
  expect(screen.getByRole("heading", { name: "Mi perfil" })).toBeInTheDocument();
  expect(screen.getByText("Cobertura FSD no verificada")).toBeInTheDocument();
});
