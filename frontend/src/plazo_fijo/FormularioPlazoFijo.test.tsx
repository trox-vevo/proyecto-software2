import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormularioPlazoFijo } from "./FormularioPlazoFijo";
import type { ParametrosPlazoFijo } from "./tipos";

const iniciales: ParametrosPlazoFijo = {
  amount: "1000.00", department: "Lima", paymentMode: "AT_MATURITY", termDays: 360,
};

function Flujo({ onSimular = () => {} }: { onSimular?: (p: ParametrosPlazoFijo) => void }) {
  const [parametros, setParametros] = useState(iniciales);
  return <FormularioPlazoFijo parametros={parametros} onCambiar={setParametros}
    onSimular={() => onSimular(parametros)} />;
}

describe("FormularioPlazoFijo · US06", () => {
  it("contiene los cuatro campos y exactamente los seis plazos del backlog", () => {
    render(<Flujo />);
    expect(screen.getByRole("textbox", { name: /Monto de inversión/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Departamento" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Modalidad/ })).toHaveValue("AT_MATURITY");
    const opciones = within(screen.getByRole("combobox", { name: "Plazo en días" })).getAllByRole("option");
    expect(opciones.map((opcion) => (opcion as HTMLOptionElement).value))
      .toEqual(["180", "360", "540", "720", "900", "1080"]);
    expect(opciones.map((opcion) => opcion.textContent))
      .toEqual(["180 días", "360 días", "540 días", "720 días", "900 días", "1080 días"]);
  });

  it("conserva y entrega los parámetros elegidos, con monto decimal como texto", async () => {
    const user = userEvent.setup();
    const simular = vi.fn();
    render(<Flujo onSimular={simular} />);
    await user.clear(screen.getByLabelText(/Monto de inversión/));
    await user.type(screen.getByLabelText(/Monto de inversión/), "9007199254740993.25");
    await user.selectOptions(screen.getByLabelText("Departamento"), "Cusco");
    await user.selectOptions(screen.getByLabelText(/Modalidad/), "MONTHLY");
    await user.selectOptions(screen.getByLabelText("Plazo en días"), "1080");
    await user.click(screen.getByRole("button", { name: "Simular plazo fijo" }));
    expect(simular).toHaveBeenCalledWith({
      amount: "9007199254740993.25", department: "Cusco", paymentMode: "MONTHLY", termDays: 1080,
    });
    expect(screen.getByLabelText(/Modalidad/)).toHaveValue("MONTHLY");
    expect(screen.getByLabelText("Plazo en días")).toHaveValue("1080");
  });

  it("no acepta un plazo externo ni una modalidad desconocida", () => {
    const cambiar = vi.fn();
    render(<FormularioPlazoFijo parametros={iniciales} onCambiar={cambiar} onSimular={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Plazo en días"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText(/Modalidad/), { target: { value: "WEEKLY" } });
    expect(cambiar).not.toHaveBeenCalled();
  });

  it.each(["", "mil", "-1", "1000.001", "1e3", "1000,00"])("rechaza formato de monto %j", (amount) => {
    const simular = vi.fn();
    render(<FormularioPlazoFijo parametros={{ ...iniciales, amount }} onCambiar={vi.fn()} onSimular={simular} />);
    fireEvent.submit(screen.getByRole("form"));
    expect(simular).not.toHaveBeenCalled();
  });

  it("deja la regla de monto mínimo al backend y bloquea envíos durante la carga", () => {
    const simular = vi.fn();
    const { rerender } = render(<FormularioPlazoFijo parametros={{ ...iniciales, amount: "499.99" }}
      onCambiar={vi.fn()} onSimular={simular} />);
    fireEvent.submit(screen.getByRole("form"));
    expect(simular).toHaveBeenCalledOnce();
    rerender(<FormularioPlazoFijo parametros={iniciales} onCambiar={vi.fn()} onSimular={simular} cargando />);
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.submit(screen.getByRole("form"));
    expect(simular).toHaveBeenCalledOnce();
  });
});
