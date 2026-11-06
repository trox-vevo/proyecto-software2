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
          nombre: "Ana Pérez",
          correo: "ana@ejemplo.com",
        }));
      }
      return new Response(JSON.stringify(perfilInicial));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ProfileEditor />);

    const nombre = await screen.findByLabelText("Nombre de usuario");
    const correo = screen.getByLabelText("Correo electrónico");
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Ana Pérez");
    await userEvent.clear(correo);
    await userEvent.type(correo, "ana@ejemplo.com");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Perfil actualizado correctamente.");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/perfil"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ nombre: "Ana Pérez", correo: "ana@ejemplo.com" }),
      }),
    );
  });

  it("muestra el error de duplicidad que devuelve el backend", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ message: "Ese correo ya está asociado a otro usuario." }), {
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
      "Ese correo ya está asociado a otro usuario.",
    );
  });
});
