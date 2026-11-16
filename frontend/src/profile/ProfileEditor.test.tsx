import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileEditor } from "./ProfileEditor";

const perfilInicial = {
  id: "usuario-demo",
  nombre: "Usuario de demostración",
  correo: "usuario@ejemplo.com",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfileEditor", () => {
  it("carga y actualiza el perfil y confirma el resultado del servidor", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({
          ...perfilInicial,
          correo: "ana@ejemplo.com",
        }));
      }
      return new Response(JSON.stringify(perfilInicial));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileEditor />);

    await screen.findByLabelText("Nombre de usuario");
    const correo = screen.getByLabelText("Correo electrónico");
    await userEvent.clear(correo);
    await userEvent.type(correo, "ana@ejemplo.com");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Tu perfil ha sido actualizado correctamente.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/perfil"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ nombre: perfilInicial.nombre, correo: "ana@ejemplo.com" }),
      }),
    );
  });

  it("muestra el error de duplicidad que devuelve el backend", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ message: "El correo ingresado ya está en uso por otra cuenta." }), {
          status: 409,
        });
      }
      return new Response(JSON.stringify(perfilInicial));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileEditor />);

    await screen.findByLabelText("Correo electrónico");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El correo ingresado ya está en uso por otra cuenta.",
    );
  });
});
