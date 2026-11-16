import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/** US08: en el simulador de ahorros, escribe el monto, elige el departamento y presiona "Buscar". */
export async function buscarAhorros(monto = "1000", departamento = "Lima"): Promise<void> {
  const campoMonto = await screen.findByRole("spinbutton", { name: /Monto total a invertir/ });
  await userEvent.clear(campoMonto);
  await userEvent.type(campoMonto, monto);
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Departamento de residencia" }), departamento);
  await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
}
