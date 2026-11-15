import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlertasSeccion } from "./AlertasSeccion";
import { alertasMock } from "./pruebas/alertasMock";

// La API se simula con fetch. Los datos son los de alertasMock.ts: 5 alertas, 4 sin leer
// (la de Cooperativa Quipu ya está leída).

function simularApi(opciones: { lista?: number; patch?: number } = {}) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "PATCH") {
      return new Response(JSON.stringify({ leida: true }), { status: opciones.patch ?? 200 });
    }
    return new Response(JSON.stringify({ alertas: alertasMock() }), { status: opciones.lista ?? 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

let fetchMock: ReturnType<typeof simularApi>;

beforeEach(() => {
  fetchMock = simularApi();
});

afterEach(() => {
  window.history.pushState(null, "", "/");
  vi.unstubAllGlobals();
});

const abrir = (entidad: string) => userEvent.click(screen.getByRole("button", { name: new RegExp(entidad) }));
const itemDe = (entidad: string) => screen.getByRole("button", { name: new RegExp(entidad) }).closest("li")!;
/** Espera a que llegue la lista: el contador pasa de "Sin alertas pendientes" a "4 alertas pendientes". */
const cargada = () => screen.findByText("4 alertas pendientes");
const guardados = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");

describe("Alertas: detalle, marcado como leída y contador (US35/US36, TS-111)", () => {
  it("al inicio muestra las 5 alertas y 4 pendientes", async () => {
    render(<AlertasSeccion />);

    expect(await cargada()).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("abrir una alerta muestra su detalle completo en el panel lateral", async () => {
    render(<AlertasSeccion />);
    await cargada();

    await abrir("Banco Andino Demo");

    const panel = screen.getByRole("complementary", { name: "Banco Andino Demo" });
    expect(within(panel).getByText("Cambio de tasa")).toBeInTheDocument();
    expect(within(panel).getByText("4.50%")).toBeInTheDocument();
    expect(within(panel).getByText("3.80%")).toBeInTheDocument();
    expect(within(panel).getByText("-15.56%")).toBeInTheDocument();
    expect(within(panel).getByText("Riesgo actualizado")).toBeInTheDocument();
    expect(within(panel).getByText("Con cobertura FSD")).toBeInTheDocument();
  });

  it("al mostrarse el panel la alerta se marca como leída y el contador baja en uno", async () => {
    render(<AlertasSeccion />);
    await cargada();
    expect(within(itemDe("Banco Andino Demo")).getByText("(no leída)")).toBeInTheDocument();

    await abrir("Banco Andino Demo");

    expect(await screen.findByText("3 alertas pendientes")).toBeInTheDocument();
    expect(within(itemDe("Banco Andino Demo")).queryByText("(no leída)")).not.toBeInTheDocument();
  });

  it("abrir una alerta que ya estaba leída no cambia el contador", async () => {
    render(<AlertasSeccion />);
    await cargada();

    await abrir("Cooperativa Quipu Demo");

    expect(screen.getByRole("complementary", { name: "Cooperativa Quipu Demo" })).toBeInTheDocument();
    expect(screen.getByText("4 alertas pendientes")).toBeInTheDocument();
  });

  it("cambiar de alerta con el panel abierto marca cada una y muestra la nueva", async () => {
    render(<AlertasSeccion />);
    await cargada();

    await abrir("Banco Andino Demo");
    await abrir("Caja Rimay Demo");

    expect(await screen.findByText("2 alertas pendientes")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Caja Rimay Demo" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Banco Andino Demo" })).not.toBeInTheDocument();
  });

  it("el panel se cierra con el botón Cerrar y con la tecla Escape", async () => {
    render(<AlertasSeccion />);
    await cargada();

    await abrir("Banco Andino Demo");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    await abrir("Caja Rimay Demo");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("la lista advierte cuando la entidad no tiene cobertura FSD y cuando no está verificada", async () => {
    render(<AlertasSeccion />);
    await cargada();

    expect(within(itemDe("Caja Rimay Demo")).getByText("Sin cobertura FSD")).toBeInTheDocument();
    expect(within(itemDe("Financiera Sol Demo")).getByText("Cobertura FSD no verificada")).toBeInTheDocument();
    expect(within(itemDe("Banco Andino Demo")).getByText("Con cobertura FSD")).toBeInTheDocument();
  });

  it("un enlace con ?alerta=3 abre directamente el detalle de esa alerta", async () => {
    window.history.pushState(null, "", "/?alerta=3");

    render(<AlertasSeccion />);

    expect(await screen.findByRole("complementary", { name: "Financiera Sol Demo" })).toBeInTheDocument();
    expect(await screen.findByText("3 alertas pendientes")).toBeInTheDocument();
  });

  it("un valor inválido en ?alerta= se ignora", async () => {
    window.history.pushState(null, "", "/?alerta=abc");

    render(<AlertasSeccion />);

    expect(await cargada()).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

describe("Alertas: carga desde la API y guardado de la lectura (TS-110)", () => {
  it("muestra un aviso de carga y pide las alertas a /api/alertas", async () => {
    render(<AlertasSeccion />);

    expect(screen.getByText("Cargando alertas…")).toBeInTheDocument();
    await cargada();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/alertas$/), expect.anything());
  });

  it("al abrir una alerta sin leer se guarda con PATCH /api/alertas/ID/leida", async () => {
    render(<AlertasSeccion />);
    await cargada();

    await abrir("Banco Andino Demo");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/alertas\/1\/leida$/),
        expect.objectContaining({ method: "PATCH" }),
      ),  
    );
    expect(guardados()).toHaveLength(1);
  });

  it("abrir una alerta que ya estaba leída no llama al PATCH", async () => {
    render(<AlertasSeccion />);
    await cargada();

    await abrir("Cooperativa Quipu Demo");

    expect(screen.getByRole("complementary", { name: "Cooperativa Quipu Demo" })).toBeInTheDocument();
    expect(guardados()).toHaveLength(0);
  });

  it("si el guardado falla, la alerta vuelve a quedar sin leer y no se reintenta en bucle", async () => {
    fetchMock = simularApi({ patch: 500 });
    render(<AlertasSeccion />);
    await cargada();

    await abrir("Banco Andino Demo");

    await waitFor(() => expect(guardados()).toHaveLength(1));
    expect(await screen.findByText("4 alertas pendientes")).toBeInTheDocument();
    expect(within(itemDe("Banco Andino Demo")).getByText("(no leída)")).toBeInTheDocument();
    expect(guardados()).toHaveLength(1);
  });

  it("sin sesión (401) pide iniciar sesión en lugar de mostrar una lista vacía", async () => {
    fetchMock = simularApi({ lista: 401 });

    render(<AlertasSeccion />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Inicia sesión para ver tus alertas.");
    expect(screen.queryByText("No tienes alertas.")).not.toBeInTheDocument();
  });

  it("si el servidor falla (500) muestra un mensaje de error", async () => {
    fetchMock = simularApi({ lista: 500 });

    render(<AlertasSeccion />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las alertas");
  });

  it("una respuesta que no trae la lista de alertas se trata como error, sin romper la página", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({}))));

    render(<AlertasSeccion />);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar las alertas");
  });
});
