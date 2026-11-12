import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAuthSession, saveAuthSession } from "../auth/session";
import { sessionStore } from "../pro_access/SessionStore";
import { Checkout } from "./Checkout";

const config = { environment: "DEMO", provider: "LOCAL_MOCK", simulation: true, cardCaptureAvailable: true,
  processingAvailable: true, realPaymentsAvailable: false, membershipActivationAvailable: true };
const configResponse = () => new Response(JSON.stringify(config));
const result = (outcome: "APPROVED" | "DECLINED" = "APPROVED") => ({
  reference: "DEMO-0123456789abcdef01234567", outcome, simulation: true, environment: "DEMO",
  occurredAt: "2026-11-06T19:00:00.000Z", planId: "PRO", amount: null,
  message: outcome === "APPROVED" ? "Operación aprobada únicamente para la demostración." : "Operación rechazada únicamente para la demostración.",
  declineReason: outcome === "DECLINED" ? "Fondos ficticios insuficientes." : null,
  plan: outcome === "APPROVED" ? "PRO" : "BASICO", planExpiresAt: outcome === "APPROVED" ? "2026-12-06T19:00:00.000Z" : null,
});
const successfulResponse = (outcome: "APPROVED" | "DECLINED" = "APPROVED") => new Response(JSON.stringify(result(outcome)));
const labels = ["Nombre o razón social", "Correo de facturación", "Nombre del titular", "Número de tarjeta", "Fecha de vencimiento", "CVV"];
const futureExpiry = `12/${String(new Date().getFullYear() + 2).slice(-2)}`;
function fill(number = "0000111122223333", decline = false) {
  const values = ["Persona de prueba", "FACTURA@example.com", "Titular solo local", number, futureExpiry, "123"];
  labels.forEach((label, index) => fireEvent.change(screen.getByLabelText(label), { target: { value: values[index] } }));
  const checkbox = screen.getByRole("checkbox", { name: "Forzar pago rechazado" });
  if ((checkbox as HTMLInputElement).checked !== decline) fireEvent.click(checkbox);
}
async function open(fetchMock = vi.fn().mockResolvedValue(configResponse()), onViewPlans = vi.fn(), onReturnToApp = vi.fn()) {
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<Checkout onViewPlans={onViewPlans} onReturnToApp={onReturnToApp} />);
  await screen.findByLabelText("Nombre o razón social");
  return { ...view, fetchMock, onViewPlans, onReturnToApp };
}
const submit = () => userEvent.click(screen.getByRole("button", { name: "Pagar ahora" }));
const expectEmpty = () => {
  labels.forEach((label) => expect(screen.getByLabelText(label)).toHaveValue(""));
  expect(screen.getByRole("checkbox", { name: "Forzar pago rechazado" })).not.toBeChecked();
};

describe("US32, checkout de simulación académica", () => {
  it("no muestra textos de simulación y valida todos los campos requeridos sin enviar datos", async () => {
    const { container, fetchMock } = await open();
    expect(document.body.textContent).not.toMatch(/DEMO|fictici|académica|simulado|práctica/i);
    expect(screen.getByRole("checkbox", { name: "Forzar pago rechazado" })).not.toBeChecked();
    expect(container.querySelectorAll("input")).toHaveLength(7);
    expect(screen.getByLabelText("CVV")).toHaveAttribute("type", "password");
    labels.forEach((label) => expect(screen.getByLabelText(label)).toHaveAttribute("autocomplete", "off"));
    await submit();
    labels.forEach((label) => expect(screen.getByLabelText(label)).toHaveAttribute("aria-invalid", "true"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("muestra aprobación, referencia, fecha y plan; envía solo escenario y facturación y limpia los campos", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const errorLog = vi.spyOn(console, "error");
    const log = vi.spyOn(console, "log");
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(successfulResponse());
    await open(fetchMock);
    fill();
    await submit();
    expect(await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" })).toBeInTheDocument();
    expect(screen.getByText("0123456789ABCDEF01234567")).toBeInTheDocument();
    expect(screen.getByText("Pro", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Tarjeta de crédito o débito")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/DEMO|fictici|académica|simulado|práctica/i);
    expect(screen.getByText(/Tu Plan Pro está activo hasta/)).toBeInTheDocument();
    expect(document.querySelector(`time[datetime="${result().occurredAt}"]`)).toBeInTheDocument();
    const [url, request] = fetchMock.mock.calls[1];
    expect(url).toContain("/api/checkout/simulate");
    expect(JSON.parse(request.body)).toEqual({ planId: "PRO", scenarioId: "DEMO_APPROVED", billing: { name: "Persona de prueba", email: "factura@example.com" } });
    expect(request.body).not.toMatch(/0000111122223333|Titular solo local|cvv|holder|expiry|cardNumber/i);
    expect(request.body).not.toContain(futureExpiry);
    expect(storage).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Intentar nuevamente" })).not.toBeInTheDocument();
  });

  it("muestra un rechazo ficticio y permite comenzar otro intento limpio", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(successfulResponse("DECLINED"));
    await open(fetchMock);
    fill(undefined, true);
    await submit();
    expect(await screen.findByRole("heading", { name: "No pudimos procesar tu pago" })).toBeInTheDocument();
    expect(screen.getByText(/Fondos insuficientes./)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/DEMO|fictici|académica|simulado|práctica/i);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).scenarioId).toBe("DEMO_DECLINED");
    await userEvent.click(screen.getByRole("button", { name: "Intentar nuevamente" }));
    expectEmpty();
  });

  it("impide una longitud, fecha y CVV incorrectos y conserva los datos para corregirlos", async () => {
    const { fetchMock } = await open();
    fill("000011112222");
    fireEvent.change(screen.getByLabelText("Fecha de vencimiento"), { target: { value: "13/99" } });
    fireEvent.change(screen.getByLabelText("CVV"), { target: { value: "12" } });
    await submit();
    expect(screen.getByLabelText("Número de tarjeta")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Fecha de vencimiento")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("CVV")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Nombre o razón social")).toHaveValue("Persona de prueba");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Número de tarjeta"), { target: { value: "0000111122223333" } });
    expect(screen.getByLabelText("Número de tarjeta")).toHaveAttribute("aria-invalid", "false");
  });

  it.each([
    ["000011112222", "exactamente 16 dígitos"],
    ["00001111222233334", "exactamente 16 dígitos"],
    ["000011112222ABCD", "solo puede contener dígitos y espacios"],
    ["0000-1111-2222-3333", "solo puede contener dígitos y espacios"],
  ])("no procesa la entrada inválida %s", async (number, message) => {
    const { fetchMock } = await open();
    fill(number);
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("agrupa los dígitos al escribir y conserva el decimoséptimo para explicar el error", async () => {
    const { fetchMock } = await open();
    fill("");
    const number = screen.getByLabelText("Número de tarjeta");
    await userEvent.type(number, "0000111122223333");
    expect(number).toHaveValue("0000 1111 2222 3333");
    await userEvent.type(number, "4");
    expect(number).toHaveValue("0000 1111 2222 3333 4");
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("exactamente 16 dígitos");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["0000 1111 2222 3333", "0000000000000001"])("aprueba un formato válido %s sin depender del número", async (number) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(successfulResponse());
    await open(fetchMock);
    fill(number);
    await submit();
    await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).scenarioId).toBe("DEMO_APPROVED");
  });

  it("permite el vencimiento durante todo el mes actual", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(successfulResponse());
    await open(fetchMock);
    fill();
    const now = new Date();
    const expiry = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getFullYear()).slice(-2)}`;
    fireEvent.change(screen.getByLabelText("Fecha de vencimiento"), { target: { value: expiry } });
    await submit();
    await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" });
  });

  it("explica una fecha vencida sin iniciar el pago", async () => {
    const { fetchMock } = await open();
    fill();
    const now = new Date();
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const expiry = `${String(previous.getMonth() + 1).padStart(2, "0")}/${String(previous.getFullYear()).slice(-2)}`;
    fireEvent.change(screen.getByLabelText("Fecha de vencimiento"), { target: { value: expiry } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("anterior al mes actual");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["12", "ABC", "1234"])("no recorta ni procesa un CVV inválido %s", async (cvv) => {
    const { fetchMock } = await open();
    fill();
    const input = screen.getByLabelText("CVV");
    await userEvent.clear(input);
    await userEvent.type(input, cvv);
    expect(input).toHaveValue(cvv);
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("El CVV debe contener exactamente 3 dígitos.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ofrece regresar a la aplicación después de aprobar", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(successfulResponse());
    const { onReturnToApp } = await open(fetchMock);
    fill();
    await submit();
    await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" });
    await userEvent.click(screen.getByRole("button", { name: "Volver a la aplicación" }));
    expect(onReturnToApp).toHaveBeenCalledOnce();
  });

  it.each([["Nombre o razón social", "   "], ["Correo de facturación", "correo-invalido"]])("conserva la validación de facturación: %s", async (label, value) => {
    const { fetchMock } = await open();
    fill();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await submit();
    expect(screen.getByLabelText(label)).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bloquea envíos repetidos mientras el backend procesa", async () => {
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    await open(fetchMock);
    fill();
    await userEvent.dblClick(screen.getByRole("button", { name: "Pagar ahora" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Procesando pago…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Procesando pago…");
    expect(screen.getByLabelText("Nombre del titular")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Forzar pago rechazado" })).toBeDisabled();
    await act(async () => finish(successfulResponse()));
    await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" });
  });

  it.each([400, 500])("maneja HTTP %i, limpia todos los campos y permite reintentar", async (status) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(new Response("{}", { status })).mockResolvedValueOnce(successfulResponse());
    await open(fetchMock);
    fill();
    await submit();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expectEmpty();
    expect(screen.queryByRole("heading", { name: /Bienvenido al Plan Pro|No pudimos procesar tu pago/ })).not.toBeInTheDocument();
    fill();
    await submit();
    await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" });
  });

  it("maneja la caída de red sin conservar los datos introducidos", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockRejectedValueOnce(new TypeError("network"));
    await open(fetchMock);
    fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar");
    expectEmpty();
    expect(screen.getByRole("button", { name: "Pagar ahora" })).toBeEnabled();
  });

  it.each([
    null, {}, { ...result(), reference: "bank-real-reference" }, { ...result(), outcome: "PAID" },
    { ...result("DECLINED") }, { ...result(), simulation: false }, { ...result(), environment: "sandbox" },
    { ...result(), planId: "BASICO" }, { ...result(), amount: 10 }, { ...result(), message: "" },
    { ...result(), occurredAt: "fecha-invalida" }, { ...result(), occurredAt: "2026-02-30T19:00:00.000Z" },
    { ...result(), declineReason: "motivo inesperado" }, { ...result(), subscription: { plan: "PRO" } },
    { ...result(), plan: "BASICO" }, { ...result(), planExpiresAt: null }, { ...result(), planExpiresAt: "mañana" },
  ])("rechaza una respuesta incompatible sin confirmar la operación: %j", async (value) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(new Response(JSON.stringify(value)));
    await open(fetchMock);
    fill();
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos confirmar tu pago");
    expectEmpty();
    expect(screen.queryByRole("heading", { name: /Bienvenido al Plan Pro|No pudimos procesar tu pago/ })).not.toBeInTheDocument();
  });

  it.each([
    null, {}, { ...config, environment: "production" }, { ...config, provider: "EXTERNAL" },
    { ...config, simulation: false }, { ...config, cardCaptureAvailable: false },
    { ...config, processingAvailable: false }, { ...config, realPaymentsAvailable: true },
    { ...config, membershipActivationAvailable: false },
  ])("bloquea configuraciones ajenas a la demostración %j", async (value) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(value))));
    render(<Checkout onViewPlans={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar la página de pago");
    expect(screen.queryByLabelText("Nombre o razón social")).not.toBeInTheDocument();
  });

  it("permite reintentar la carga de configuración", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 500 })).mockResolvedValueOnce(configResponse());
    vi.stubGlobal("fetch", fetchMock);
    render(<Checkout onViewPlans={vi.fn()} />);
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByLabelText("Nombre del titular");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborta al volver a planes y limpia los campos sin aceptar una respuesta tardía", async () => {
    let finish!: (value: unknown) => void;
    const response = { ok: true, status: 200, json: () => new Promise((resolve) => { finish = resolve; }) };
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(response);
    const { onViewPlans } = await open(fetchMock);
    fill();
    await submit();
    const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    await userEvent.click(screen.getByRole("button", { name: "Volver a planes" }));
    expect(onViewPlans).toHaveBeenCalledOnce();
    expect(signal.aborted).toBe(true);
    expectEmpty();
    await act(async () => finish(result()));
    expect(screen.queryByRole("heading", { name: /Bienvenido al Plan Pro|No pudimos procesar tu pago/ })).not.toBeInTheDocument();
  });

  it("limpia en pagehide, aborta y no muestra un JSON tardío al volver desde BFCache", async () => {
    let finish!: (value: unknown) => void;
    const response = { ok: true, status: 200, json: () => new Promise((resolve) => { finish = resolve; }) };
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(response).mockResolvedValueOnce(successfulResponse("DECLINED"));
    await open(fetchMock);
    fill();
    await submit();
    const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    fireEvent(window, new Event("pagehide"));
    expect(signal.aborted).toBe(true);
    expectEmpty();
    await act(async () => finish(result()));
    expect(screen.queryByRole("heading", { name: /Bienvenido al Plan Pro|No pudimos procesar tu pago/ })).not.toBeInTheDocument();
    fill(undefined, true);
    await submit();
    await screen.findByRole("heading", { name: "No pudimos procesar tu pago" });
    fireEvent(window, new Event("pagehide"));
    expectEmpty();
    expect(screen.queryByRole("heading", { name: /Bienvenido al Plan Pro|No pudimos procesar tu pago/ })).not.toBeInTheDocument();
  });

  it("aborta al desmontarse y un nuevo checkout comienza vacío", async () => {
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; })).mockResolvedValueOnce(configResponse());
    const first = await open(fetchMock);
    fill();
    await submit();
    const signal = fetchMock.mock.calls[1][1].signal as AbortSignal;
    first.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(successfulResponse()));
    await open(fetchMock);
    expectEmpty();
    expect(screen.queryByRole("heading", { name: /Bienvenido al Plan Pro|No pudimos procesar tu pago/ })).not.toBeInTheDocument();
  });
});

// US33: el pago aprobado activa el Plan Pro en la sesión; el rechazo explica el motivo.
describe("US33, procesamiento de pago y activación del Plan Pro", () => {
  const basicSession = () => saveAuthSession({
    id: "s1", userId: 7, tokenJwt: "token-de-prueba", expiresAt: new Date(Date.now() + 3_600_000).toISOString(), plan: "BASICO",
  });
  afterEach(() => clearAuthSession());

  it("aprobado: desbloquea Pro en tiempo real y muestra la fecha de vencimiento", async () => {
    basicSession();
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(successfulResponse());
    await open(fetchMock);
    fill();
    await submit();
    expect(await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" })).toBeInTheDocument();
    expect(sessionStore.isPro()).toBe(true);
    expect(screen.getByText(/Tu Plan Pro está activo hasta/)).toBeInTheDocument();
    expect(document.querySelector(`time[datetime="${result().planExpiresAt}"]`)).toBeInTheDocument();
    expect(screen.getByText("Informe de riesgo avanzado")).toBeInTheDocument();
  });

  it("envía el token de sesión en el header Authorization", async () => {
    basicSession();
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(successfulResponse());
    await open(fetchMock);
    fill();
    await submit();
    await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" });
    const [url, request] = fetchMock.mock.calls[1];
    expect(url).toContain("/api/checkout/simulate");
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer token-de-prueba");
  });

  it("rechazado: muestra el motivo e 'Intentar nuevamente' y el usuario sigue Básico", async () => {
    basicSession();
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse()).mockResolvedValueOnce(successfulResponse("DECLINED"));
    await open(fetchMock);
    fill(undefined, true);
    await submit();
    expect(await screen.findByRole("heading", { name: "No pudimos procesar tu pago" })).toBeInTheDocument();
    expect(screen.getByText(/Fondos insuficientes./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intentar nuevamente" })).toBeInTheDocument();
    expect(sessionStore.isPro()).toBe(false);
  });

  it("sin sesión (401) pide iniciar sesión sin mostrar códigos técnicos", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "AUTHENTICATION_REQUIRED", message: "x" }), { status: 401 }));
    await open(fetchMock);
    fill();
    await submit();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Inicia sesión para suscribirte al Plan Pro.");
    expect(alert).not.toHaveTextContent("AUTHENTICATION_REQUIRED");
  });
});
