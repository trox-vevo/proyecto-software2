
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GlosarioFinanciero } from "./GlosarioFinanciero";

afterEach(() => {
  cleanup();
});

describe("US24 - Glosario financiero", () => {
  it("muestra el panel cuando está abierto", () => {
    render(
      <GlosarioFinanciero
        abierto={true}
        terminoSeleccionado={null}
        onCerrar={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Glosario financiero")).toBeTruthy();
  });

  it("muestra la definición destacada del FSD", () => {
    const { container } = render(
      <GlosarioFinanciero
        abierto={true}
        terminoSeleccionado="FSD"
        onCerrar={vi.fn()}
      />
    );

    const destacado = container.querySelector(".glosario-destacado");

    expect(destacado).not.toBeNull();
    expect(destacado?.textContent).toContain("FSD");
    expect(destacado?.textContent).toContain(
      "Fondo de Seguro de Depósitos"
    );
  });

  it("permite buscar términos financieros", () => {
    render(
      <GlosarioFinanciero
        abierto={true}
        terminoSeleccionado={null}
        onCerrar={vi.fn()}
      />
    );

    const buscador = screen.getByRole("searchbox");

    fireEvent.change(buscador, {
      target: { value: "TREA" }
    });

    expect(
      screen.getByRole("heading", { name: "TREA" })
    ).toBeTruthy();

    expect(
      screen.queryByRole("heading", { name: "FSD" })
    ).toBeNull();
  });

  it("permite cerrar el glosario", () => {
    const cerrar = vi.fn();

    render(
      <GlosarioFinanciero
        abierto={true}
        terminoSeleccionado={null}
        onCerrar={cerrar}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar glosario" })
    );

    expect(cerrar).toHaveBeenCalledOnce();
  });

  it("permite cerrar el panel con Escape", () => {
    const cerrar = vi.fn();

    render(
      <GlosarioFinanciero
        abierto={true}
        terminoSeleccionado={null}
        onCerrar={cerrar}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(cerrar).toHaveBeenCalledOnce();
  });
});
