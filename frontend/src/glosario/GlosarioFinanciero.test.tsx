import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useState } from "react";
import { describe, expect, it } from "vitest";
import { GlosarioFinanciero } from "./GlosarioFinanciero";

function Example() {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  return <><button onClick={() => setAbierto(true)}>Consultar TEA</button><GlosarioFinanciero abierto={abierto} terminoSeleccionado="TEA" onCerrar={cerrar} /></>;
}
describe("Glosario interactivo", () => {
  it("abre el término solicitado y navega a otra definición", async () => {
    render(<Example />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Consultar TEA" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "TEA" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "FSD" }));
    expect(within(dialog).getByRole("heading", { name: "FSD" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Fuente: SBS" })).toBeInTheDocument();
  });
  it("busca sin distinguir tildes, muestra vacíos y restaura resultados", async () => {
    render(<Example />); await userEvent.click(screen.getByText("Consultar TEA"));
    const input = screen.getByRole("searchbox");
    await userEvent.type(input, "deposito");
    expect(screen.getByRole("button", { name: "Depósito a plazo fijo" })).toBeInTheDocument();
    await userEvent.clear(input); await userEvent.type(input, "zzzz");
    expect(screen.getByText("No se encontraron términos.")).toBeInTheDocument();
    await userEvent.clear(input);
    expect(screen.getByRole("button", { name: "Capital inicial" })).toBeInTheDocument();
  });
  it("mantiene el foco en el panel y lo devuelve al enlace al cerrar con Escape", async () => {
    render(<Example />); const trigger = screen.getByText("Consultar TEA");
    await userEvent.click(trigger);
    const close = screen.getByRole("button", { name: "Cerrar glosario" });
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "TREA" })).toHaveFocus();
    await userEvent.tab(); expect(close).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
  });
  it("cierra con el botón y se puede volver a abrir", async () => {
    render(<Example />); await userEvent.click(screen.getByText("Consultar TEA"));
    await userEvent.click(screen.getByRole("button", { name: "Cerrar glosario" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Consultar TEA"));
    expect(screen.getByRole("heading", { name: "TEA" })).toBeInTheDocument();
  });
});
