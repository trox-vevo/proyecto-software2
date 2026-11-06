import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrationForm } from "./RegistrationForm";
import { RegistrationRoute } from "./RegistrationRoute";
import App from "../App";

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });
async function complete(email = "estudiante@example.com") {
  await userEvent.type(screen.getByLabelText("Nombre de usuario"), "Estudiante");
  await userEvent.type(screen.getByLabelText("Correo electrónico"), email);
  await userEvent.type(screen.getByLabelText("Contraseña", { exact: true }), "Clave-segura-123");
  await userEvent.type(screen.getByLabelText("Confirmar contraseña"), "Clave-segura-123");
}
describe("Formulario de registro", () => {
  it("muestra validaciones y no solicita la API si hay datos inválidos", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<RegistrationForm onRegistered={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(screen.getByText(/Ingresa un correo electrónico válido/)).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rechaza la confirmación distinta", async () => {
    render(<RegistrationForm onRegistered={vi.fn()} />); await complete();
    await userEvent.type(screen.getByLabelText("Confirmar contraseña"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
  });
  it("envía el contrato esperado y redirige a /login después de un 201", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 })); vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/registro");
    render(<RegistrationRoute><p>Inicio</p></RegistrationRoute>); await complete("ESTUDIANTE@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("Cuenta creada correctamente.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    const options = fetchMock.mock.calls[0][1];
    expect(JSON.parse(options.body)).toEqual({ username: "Estudiante", email: "estudiante@example.com", password: "Clave-segura-123" });
    await userEvent.click(screen.getByRole("link", { name: "Volver al inicio" }));
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });
  it.each([409, 400, 500])("muestra el error HTTP %i y conserva el formulario", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    const success = vi.fn(); render(<RegistrationForm onRegistered={success} />); await complete();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    if (status === 409) expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
    expect(success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
  });
  it("permite reintentar después de una caída de red", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const success = vi.fn(); render(<RegistrationForm onRegistered={success} />); await complete();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(success).toHaveBeenCalledOnce();
  });
  it("bloquea envíos repetidos mientras espera respuesta", async () => {
    let resolve!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done; })); vi.stubGlobal("fetch", fetchMock);
    render(<RegistrationForm onRegistered={vi.fn()} />); await complete();
    await userEvent.dblClick(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Creando cuenta…" })).toBeDisabled();
    resolve(new Response("{}", { status: 500 }));
    await screen.findByRole("alert");
  });
  it("permite abrir y abandonar registro, y responde a la navegación del navegador", async () => {
    render(<RegistrationRoute><p>Simulador</p></RegistrationRoute>);
    await userEvent.click(screen.getByRole("link", { name: "Crear cuenta" }));
    expect(window.location.pathname).toBe("/registro");
    expect(screen.getByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Volver al inicio" }));
    expect(screen.getByText("Simulador")).toBeInTheDocument();
    act(() => { window.history.replaceState(null, "", "/registro"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();
  });
  it("abre el formulario desde App, envía el registro y vuelve al simulador", async () => {
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.includes("/api/users/register")) {
        expect(options?.method).toBe("POST");
        return new Response("{}", { status: 201 });
      }
      return new Response(JSON.stringify({ resultados: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await screen.findByText("No hay cuentas que mostrar.");
    await userEvent.click(screen.getByRole("link", { name: "Crear cuenta" }));
    await complete();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("Cuenta creada correctamente.")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    await userEvent.click(screen.getByRole("link", { name: "Volver al inicio" }));
    expect(screen.getByRole("heading", { name: "Configura tu inversión" })).toBeInTheDocument();
  });
  it("no declara éxito ante un 200 inesperado de una API mal configurada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html></html>", { status: 200 })));
    const success = vi.fn();
    render(<RegistrationForm onRegistered={success} />);
    await complete();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo crear tu cuenta");
    expect(success).not.toHaveBeenCalled();
  });
  it("abandonar el formulario cancela la espera y evita una redirección tardía", async () => {
    let resolve!: (response: Response) => void;
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: string, options?: RequestInit) => {
      signal = options?.signal;
      return new Promise<Response>((done) => { resolve = done; });
    }));
    window.history.replaceState(null, "", "/registro");
    render(<RegistrationRoute><p>Simulador</p></RegistrationRoute>);
    await complete();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await userEvent.click(screen.getByRole("link", { name: "Volver al inicio" }));
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolve(new Response("{}", { status: 201 })); });
    expect(window.location.pathname).toBe("/");
    expect(screen.getByText("Simulador")).toBeInTheDocument();
    expect(screen.queryByText("Cuenta creada correctamente.")).not.toBeInTheDocument();
  });
});
