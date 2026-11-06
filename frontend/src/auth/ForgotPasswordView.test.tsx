import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordView } from "./ForgotPasswordView";
import { RegistrationRoute } from "../registration/RegistrationRoute";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("pantalla de recuperación de contraseña", () => {
  it("envía el correo y muestra un mensaje que no revela si la cuenta existe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Si el correo existe, recibirás un enlace de recuperación." }),
        { status: 202 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ForgotPasswordView />);

    await userEvent.type(screen.getByLabelText("Correo electrónico"), "cuenta@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Si el correo existe, recibirás un enlace de recuperación.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/forgot-password"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "cuenta@example.com" }),
      }),
    );
  });

  it("muestra errores del servidor y permite reintentar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "No se pudo enviar el correo." }), { status: 503 }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ForgotPasswordView />);
    await userEvent.type(screen.getByLabelText("Correo electrónico"), "cuenta@example.com");

    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo enviar el correo.");
    await userEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("permite llegar a recuperación desde el enlace de inicio de sesión", async () => {
    window.history.replaceState(null, "", "/login");
    render(
      <RegistrationRoute>
        <p>Inicio</p>
      </RegistrationRoute>,
    );

    await userEvent.click(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" }));
    expect(screen.getByRole("heading", { name: "Recuperar contraseña" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/recuperar-contrasena");
  });
});
