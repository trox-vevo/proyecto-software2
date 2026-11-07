import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrationRoute } from "../registration/RegistrationRoute";
import { ResetPasswordView } from "./ResetPasswordView";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

async function completeNewPassword() {
  await userEvent.type(
    screen.getByLabelText("Nueva contraseña", { selector: "input" }),
    "Nueva-clave-segura-456",
  );
  await userEvent.type(
    screen.getByLabelText("Confirmar contraseña", { selector: "input" }),
    "Nueva-clave-segura-456",
  );
}

describe("pantalla de restablecimiento de contraseña", () => {
  it("valida la confirmación antes de llamar a la API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordView token="token-valido" onReset={vi.fn()} />);

    await userEvent.type(
      screen.getByLabelText("Nueva contraseña", { selector: "input" }),
      "Nueva-clave-segura-456",
    );
    await userEvent.type(
      screen.getByLabelText("Confirmar contraseña", { selector: "input" }),
      "otra-clave",
    );
    await userEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Las contraseñas no coinciden.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envía el token y contraseña y redirige al login al tener éxito", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Contraseña actualizada correctamente." }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/restablecer-contrasena?token=token-de-prueba");
    render(
      <RegistrationRoute>
        <p>Inicio</p>
      </RegistrationRoute>,
    );

    await completeNewPassword();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    expect(await screen.findByText(/Contraseña actualizada correctamente/)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/reset-password"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "token-de-prueba", newPassword: "Nueva-clave-segura-456" }),
      }),
    );
  });

  it("muestra el error de token inválido o expirado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "El enlace de recuperación es inválido o ha expirado." }), {
          status: 400,
        }),
      ),
    );
    render(<ResetPasswordView token="expirado" onReset={vi.fn()} />);
    await completeNewPassword();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("inválido o ha expirado");
  });

  it("rechaza un enlace sin token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordView token={null} onReset={vi.fn()} />);
    await completeNewPassword();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar contraseña" }));

    expect(screen.getByRole("alert")).toHaveTextContent("inválido o ha expirado");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
