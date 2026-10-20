import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlazoFijoView } from "./PlazoFijoView";
import App from "../App";

const fila = {
  productId: 2, entityName: "Entidad de prueba", tea: "0.0575",
  totalInterest: "56.04", monthlyInterest: "4.67", minimumAmount: "1000.00",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
function completar() {
  fireEvent.change(screen.getByLabelText(/Monto de inversión/), { target: { value: "1000.00" } });
  fireEvent.change(screen.getByLabelText(/Modalidad/), { target: { value: "MONTHLY" } });
  fireEvent.submit(screen.getByRole("form"));
}

describe("Flujo US06 + US12", () => {
  it("envía los cuatro parámetros al endpoint existente y muestra su respuesta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([fila]));
    vi.stubGlobal("fetch", fetchMock);
    render(<PlazoFijoView />);
    completar();
    expect(await screen.findByText("Entidad de prueba")).toBeInTheDocument();
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/simulations\/fixed-deposits$/);
    expect(opciones.method).toBe("POST");
    expect(opciones.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(opciones.body)).toEqual({
      amount: "1000.00", department: "Lima", paymentMode: "MONTHLY", termDays: 360,
    });
    expect(screen.getByText("S/ 56.04")).toBeInTheDocument();
    expect(screen.getByText("S/ 4.67")).toBeInTheDocument();
  });

  it("descarta resultados antiguos al editar y conserva los campos durante la nueva simulación", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json([fila]))
      .mockResolvedValueOnce(json([{ ...fila, totalInterest: "57.50", monthlyInterest: null }])));
    render(<PlazoFijoView />);
    completar();
    await screen.findByText("Intereses Mensuales (Aproximado)");
    fireEvent.change(screen.getByLabelText(/Modalidad/), { target: { value: "AT_MATURITY" } });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Monto de inversión/)).toHaveValue("1000.00");
    fireEvent.submit(screen.getByRole("form"));
    await screen.findByText("S/ 57.50");
    expect(screen.queryByText("Intereses Mensuales (Aproximado)")).not.toBeInTheDocument();
  });

  it("cancela una solicitud al cambiar parámetros e ignora su respuesta tardía", async () => {
    let resolver!: (respuesta: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => { resolver = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PlazoFijoView />);
    completar();
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Plazo en días"), { target: { value: "180" } });
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { resolver(json([fila])); });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Plazo en días")).toHaveValue("180");
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("muestra la validación del backend y permite corregir y volver a enviar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ message: "El monto mínimo de apertura es S/ 500.00." }, 400))
      .mockResolvedValueOnce(json([fila])));
    render(<PlazoFijoView />);
    // US07: con 499.99 ya no se llama al backend, así que usamos 500.00 para probar el error del servidor.
    fireEvent.change(screen.getByLabelText(/Monto de inversión/), { target: { value: "500.00" } });
    fireEvent.submit(screen.getByRole("form"));
    expect(await screen.findByRole("alert")).toHaveTextContent("El monto mínimo de apertura es S/ 500.00.");
    expect(screen.getByLabelText(/Monto de inversión/)).toHaveValue("500.00");
    completar();
    await screen.findByText("Entidad de prueba");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("muestra un error de conexión sin borrar parámetros", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<PlazoFijoView />);
    completar();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar");
    expect(screen.getByLabelText(/Modalidad/)).toHaveValue("MONTHLY");
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("acepta respuestas vacías del backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([])));
    render(<PlazoFijoView />);
    completar();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No hay depósitos"));
  });

  it("mantiene el módulo de ahorros y conserva los parámetros al alternar las secciones", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ resultados: [{
      cuentaId: "AH-001", capitalInicial: "1,000.00", interesGenerado: "50.00",
      saldoFinal: "1,050.00", fechaApertura: "10/01/2023",
    }] })));
    render(<App />);
    expect(await screen.findByText("AH-001")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Depósito a Plazo Fijo" }));
    await user.type(screen.getByLabelText(/Monto de inversión/), "1234.50");
    await user.selectOptions(screen.getByLabelText(/Modalidad/), "MONTHLY");
    await user.click(screen.getByRole("button", { name: "Cuentas de ahorro" }));
    expect(screen.getByText("AH-001")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Depósito a Plazo Fijo" }));
    expect(screen.getByLabelText(/Monto de inversión/)).toHaveValue("1234.50");
    expect(screen.getByLabelText(/Modalidad/)).toHaveValue("MONTHLY");
  });
});
