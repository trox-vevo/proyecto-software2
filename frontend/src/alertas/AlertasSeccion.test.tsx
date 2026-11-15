import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AlertasSeccion } from "./AlertasSeccion";

// Usan los datos de alertasMock.ts: 5 alertas, 4 sin leer (la de Cooperativa Quipu ya está leída).

afterEach(() => {
  window.history.pushState(null, "", "/");
});

const abrir = (entidad: string) => userEvent.click(screen.getByRole("button", { name: new RegExp(entidad) }));
const itemDe = (entidad: string) => screen.getByRole("button", { name: new RegExp(entidad) }).closest("li")!;

describe("Alertas: detalle, marcado como leída y contador (US35/US36, TS-111)", () => {
  it("al inicio muestra las 5 alertas y 4 pendientes", () => {
    render(<AlertasSeccion />);

    expect(screen.getByText("4 alertas pendientes")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("abrir una alerta muestra su detalle completo en el panel lateral", async () => {
    render(<AlertasSeccion />);

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
    expect(within(itemDe("Banco Andino Demo")).getByText("(no leída)")).toBeInTheDocument();

    await abrir("Banco Andino Demo");

    expect(await screen.findByText("3 alertas pendientes")).toBeInTheDocument();
    expect(within(itemDe("Banco Andino Demo")).queryByText("(no leída)")).not.toBeInTheDocument();
  });

  it("abrir una alerta que ya estaba leída no cambia el contador", async () => {
    render(<AlertasSeccion />);

    await abrir("Cooperativa Quipu Demo");

    expect(screen.getByRole("complementary", { name: "Cooperativa Quipu Demo" })).toBeInTheDocument();
    expect(screen.getByText("4 alertas pendientes")).toBeInTheDocument();
  });

  it("cambiar de alerta con el panel abierto marca cada una y muestra la nueva", async () => {
    render(<AlertasSeccion />);

    await abrir("Banco Andino Demo");
    await abrir("Caja Rimay Demo");

    expect(await screen.findByText("2 alertas pendientes")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Caja Rimay Demo" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Banco Andino Demo" })).not.toBeInTheDocument();
  });

  it("el panel se cierra con el botón Cerrar y con la tecla Escape", async () => {
    render(<AlertasSeccion />);

    await abrir("Banco Andino Demo");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    await abrir("Caja Rimay Demo");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("la lista advierte cuando la entidad no tiene cobertura FSD y cuando no está verificada", () => {
    render(<AlertasSeccion />);

    expect(within(itemDe("Caja Rimay Demo")).getByText("Sin cobertura FSD")).toBeInTheDocument();
    expect(within(itemDe("Financiera Sol Demo")).getByText("Cobertura FSD no verificada")).toBeInTheDocument();
    expect(within(itemDe("Banco Andino Demo")).getByText("Con cobertura FSD")).toBeInTheDocument();
  });

  it("un enlace con ?alerta=3 abre directamente el detalle de esa alerta", () => {
    window.history.pushState(null, "", "/?alerta=3");

    render(<AlertasSeccion />);

    expect(screen.getByRole("complementary", { name: "Financiera Sol Demo" })).toBeInTheDocument();
    expect(screen.getByText("3 alertas pendientes")).toBeInTheDocument();
  });

  it("un valor inválido en ?alerta= se ignora", () => {
    window.history.pushState(null, "", "/?alerta=abc");

    render(<AlertasSeccion />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByText("4 alertas pendientes")).toBeInTheDocument();
  });
});
