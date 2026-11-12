import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "./FavoriteButton";

describe("US28, guardar desde la interfaz", () => {
  it.each([true, false])("confirma el guardado o su reintento idempotente, created=%s", async (created) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ favorite: { id: 7 }, created }), { status: created ? 201 : 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<FavoriteButton accountId="A" days={365} onViewPlans={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar favorito de A" }));
    expect(await screen.findByRole("status")).toHaveTextContent(created ? "Simulación guardada como favorita." : "Esta simulación ya estaba guardada.");
    expect(screen.getByRole("button", { name: "Guardar favorito de A" })).toBeDisabled();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/favorites");
    expect(JSON.parse(request.body)).toEqual({ instrument: "AHORROS", accountId: "A", days: 365 });
  });

  it.each([
    [401, "Inicia sesión"], [403, "Plan Pro"], [404, "ya no está disponible"],
    [503, "pendiente de integrar"], [500, "No se pudo guardar"],
  ])("explica el error HTTP %i y permite reintentar", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    const plans = vi.fn();
    render(<FavoriteButton accountId="A" days={365} onViewPlans={plans} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar favorito de A" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(String(message));
    expect(screen.getByRole("button", { name: "Guardar favorito de A" })).toBeEnabled();
    if (status === 403) {
      await userEvent.click(screen.getByRole("button", { name: "Comparar planes" }));
      expect(plans).toHaveBeenCalledOnce();
    }
  });

  it("bloquea el doble envío y cancela la espera al desmontarse", async () => {
    let resolve!: (value: Response) => void;
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<FavoriteButton accountId="A" days={365} onViewPlans={vi.fn()} />);
    await userEvent.dblClick(screen.getByRole("button", { name: "Guardar favorito de A" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Guardar favorito de A" })).toBeDisabled();
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    view.unmount();
    expect(request.signal?.aborted).toBe(true);
    await act(async () => { resolve(new Response("{}", { status: 201 })); });
  });

  it("permite reintentar tras una caída de red y rechaza una respuesta inválida", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<FavoriteButton accountId="A" days={365} onViewPlans={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Guardar favorito de A" });
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Revisa la conexión");
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(button).toBeEnabled();
  });

  it.each(["legacy-uuid", "7", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rechaza un identificador de favorito incompatible %s", async (id) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ favorite: { id }, created: true }), { status: 201 })));
    render(<FavoriteButton accountId="A" days={365} onViewPlans={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Guardar favorito de A" });
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(button).toBeEnabled();
  });
});
