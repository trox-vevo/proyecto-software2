import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAuthSession, type UserPlan } from "../auth/session";
import { PlazoFijoView } from "../plazo_fijo/PlazoFijoView";
import { RiskBadge } from "./RiskBadge";
import { sessionStore } from "./SessionStore";

// US27 (TS-84): Escenarios 1 y 2 del lado del navegador.
const loginAs = (plan: UserPlan) =>
  saveAuthSession({
    id: "sesion-1",
    userId: 1,
    tokenJwt: "token-de-prueba",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    plan,
  });

const renderBadge = (riskRating: string | null, onViewPlans = vi.fn(), onReportLoaded = vi.fn()) =>
  render(<RiskBadge entityId={7} riskRating={riskRating} onViewPlans={onViewPlans} onReportLoaded={onReportLoaded} />);

const badge = () => screen.getByRole("button", { name: /Exclusivo Pro|A\+/ });

beforeEach(() => {
  window.localStorage.clear();
});

describe("Escenario 1: candado en lugar de la calificación", () => {
  it("usuario Básico: ve 'Exclusivo Pro' y ninguna calificación", () => {
    loginAs("BASICO");
    renderBadge(null);
    expect(badge()).toHaveTextContent("Exclusivo Pro");
    expect(screen.queryByText("A+")).not.toBeInTheDocument();
  });

  it("usuario Básico: aunque llegue una calificación, no se muestra", () => {
    loginAs("BASICO");
    renderBadge("A+");
    expect(badge()).toHaveTextContent("Exclusivo Pro");
    expect(screen.queryByText("A+")).not.toBeInTheDocument();
  });

  it("sin sesión: se trata como no Pro", () => {
    renderBadge("A+");
    expect(badge()).toHaveTextContent("Exclusivo Pro");
  });

  it("usuario Pro: ve la calificación", () => {
    loginAs("PRO");
    renderBadge("A+");
    expect(badge()).toHaveTextContent("A+");
  });

  it("usuario Pro sin calificación: muestra el candado, nunca un hueco vacío", () => {
    loginAs("PRO");
    renderBadge(null);
    expect(badge()).toHaveTextContent("Exclusivo Pro");
  });
});

describe("Escenario 2: clic en la zona restringida", () => {
  it("usuario Básico: abre el paywall con beneficios y botón, sin llamar a la API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    loginAs("BASICO");
    renderBadge(null);

    await userEvent.click(badge());

    const dialog = screen.getByRole("dialog", { name: "Desbloquea el Plan Pro" });
    expect(dialog).toHaveTextContent("Informe del economista");
    expect(screen.getByRole("button", { name: "Suscribirme al Plan Pro" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("usuario Pro: llama una vez al informe de la entidad con su token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ entityId: 7 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onReportLoaded = vi.fn();
    loginAs("PRO");
    renderBadge("A+", vi.fn(), onReportLoaded);

    await userEvent.click(badge());

    await waitFor(() => expect(onReportLoaded).toHaveBeenCalledWith({ entityId: 7 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/risk-reports\/7$/);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-de-prueba");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("usuario Pro y la API responde 403: pasa a Básico y abre el paywall, sin error técnico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
    loginAs("PRO");
    renderBadge("A+");

    await userEvent.click(badge());

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(sessionStore.isPro()).toBe(false);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(badge()).toHaveTextContent("Exclusivo Pro");
  });

  it.each([
    ["error de red", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["error del servidor", () => Promise.resolve(new Response("{}", { status: 500 }))],
  ])("usuario Pro con %s: mensaje amigable", async (_, response) => {
    vi.stubGlobal("fetch", vi.fn(response));
    loginAs("PRO");
    renderBadge("A+");

    await userEvent.click(badge());

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar el informe. Intenta de nuevo.");
  });

  it("'Suscribirme al Plan Pro' lleva a planes y cierra el modal", async () => {
    const onViewPlans = vi.fn();
    loginAs("BASICO");
    renderBadge(null, onViewPlans);

    await userEvent.click(badge());
    await userEvent.click(screen.getByRole("button", { name: "Suscribirme al Plan Pro" }));

    expect(onViewPlans).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["el botón 'Cerrar'", () => userEvent.click(screen.getByRole("button", { name: "Cerrar" }))],
    ["la tecla Escape", () => userEvent.keyboard("{Escape}")],
  ])("se cierra con %s", async (_, close) => {
    loginAs("BASICO");
    renderBadge(null);

    await userEvent.click(badge());
    await close();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// DoD: lo que se revisa en la pestaña Network, sobre la tabla real de plazo fijo (US12).
describe("Tabla de plazo fijo con un usuario Básico", () => {
  it("simula con su token, ve candados y el clic abre el paywall sin pedir el informe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { productId: 2, entityName: "Entidad de prueba", tea: "0.0575", totalInterest: "57.50",
        monthlyInterest: null, minimumAmount: "1000.00", riskRating: null },
    ]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const onViewPlans = vi.fn();
    loginAs("BASICO");
    render(<PlazoFijoView onViewPlans={onViewPlans} />);

    fireEvent.change(screen.getByLabelText(/Monto de inversión/), { target: { value: "1000.00" } });
    fireEvent.submit(screen.getByRole("form"));
    const tabla = await screen.findByRole("table");

    expect(within(tabla).getByRole("columnheader", { name: "Calificación" })).toBeInTheDocument();
    const [simulacionUrl, simulacion] = fetchMock.mock.calls[0];
    expect(String(simulacionUrl)).toMatch(/\/api\/simulations\/fixed-deposits$/);
    expect(new Headers(simulacion.headers).get("Authorization")).toBe("Bearer token-de-prueba");

    await userEvent.click(within(tabla).getByRole("button", { name: "Exclusivo Pro" }));
    expect(screen.getByRole("dialog", { name: "Desbloquea el Plan Pro" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // solo la simulación, nunca /api/risk-reports

    await userEvent.click(screen.getByRole("button", { name: "Suscribirme al Plan Pro" }));
    expect(onViewPlans).toHaveBeenCalledOnce();
  });
});

describe("SessionStore", () => {
  it("setPlan sin sesión no crea una sesión", () => {
    sessionStore.setPlan("PRO");
    expect(window.localStorage.length).toBe(0);
    expect(sessionStore.isPro()).toBe(false);
  });
});
