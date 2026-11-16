import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { getStoredSession, saveAuthSession, type UserPlan } from "../auth/session";
import { PlanComparison } from "../commerce/PlanComparison";
import { PRO_MONTHLY_PRICE } from "../commerce/types";
import { PaywallModal } from "../pro_access/PaywallModal";

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

const catalogo = {
  plans: [
    { id: "BASICO", name: "Básico", price: "0.00", billingPeriod: "MONTHLY", features: { favorites: false } },
    { id: "PRO", name: "Pro", price: "9.90", billingPeriod: "MONTHLY", features: { favorites: true } },
  ],
  features: [{ id: "favorites", label: "Guardar simulaciones favoritas" }],
};
const favoritoPlazoFijo = {
  id: 3,
  parameters: { instrument: "PLAZO_FIJO", productId: 1, amount: "1500.00", termDays: 360, department: "Lima", paymentMode: "AT_MATURITY" },
  snapshot: { entityName: "Entidad A" },
  createdAt: "2026-11-14T12:00:00.000Z",
};

function api() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/plans")) return Response.json(catalogo);
    if (url.endsWith("/api/checkout/config")) return Response.json({
      environment: "DEMO", provider: "LOCAL_MOCK", simulation: true, cardCaptureAvailable: true, processingAvailable: true,
      realPaymentsAvailable: false, membershipActivationAvailable: true, price: "9.90", currency: "PEN", billingPeriod: "MONTHLY",
    });
    if (url.endsWith("/api/subscription/history")) return Response.json({ plan: getStoredSession()?.plan ?? "BASICO", planExpiresAt: getStoredSession()?.planExpiresAt ?? null, planCancellationRequested: false, history: [] });
    if (url.endsWith("/api/favorites") && !init?.method) return Response.json({ favorites: [favoritoPlazoFijo] });
    if (url.endsWith("/api/simulations/fixed-deposits")) return Response.json([]);
    return Response.json({ resultados: [{
      cuentaId: "A", capitalInicial: "1,000.00", interesGenerado: "50.00", saldoFinal: "1,050.00", fechaApertura: "01/01/2024",
      monthlyMaintenanceFee: "0.00", channels: { hasPhysicalBranches: true, hasAtms: true },
    }] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function iniciarSesion(plan: UserPlan) {
  saveAuthSession({
    id: "s1", userId: 7, tokenJwt: "token", plan,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    planExpiresAt: plan === "PRO" ? new Date(Date.now() + 86_400_000 * 20).toISOString() : null,
    planCancellationRequested: false,
  });
}

function abrir(ruta: string) {
  window.history.replaceState(null, "", ruta);
  return render(<App />);
}

const navPrincipal = () => screen.getByRole("navigation", { name: "Navegación principal" });

describe("Pantallas y cabecera común", () => {
  it("1. Inicio muestra la bienvenida y las 3 tarjetas, sin simuladores", () => {
    api();
    abrir("/");
    expect(screen.getByRole("heading", { level: 1, name: "Compara dónde guardar tu dinero" })).toBeInTheDocument();
    for (const titulo of ["Cuenta de ahorros", "Depósito a plazo fijo", "Aprende"]) {
      expect(screen.getByRole("heading", { level: 2, name: titulo })).toBeInTheDocument();
    }
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Configura tu inversión" })).not.toBeInTheDocument();
  });

  it("2. desde Inicio se llega a cada simulador", async () => {
    api();
    abrir("/");
    await userEvent.click(screen.getByRole("button", { name: "Simular ahorros" }));
    expect(window.location.pathname).toBe("/simular/ahorros");
    expect(await screen.findByRole("table")).toBeInTheDocument();
    await userEvent.click(within(navPrincipal()).getByRole("link", { name: "Inicio" }));
    await userEvent.click(screen.getByRole("button", { name: "Simular plazo fijo" }));
    expect(window.location.pathname).toBe("/simular/plazo-fijo");
    expect(screen.getByRole("region", { name: "Depósito a Plazo Fijo" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Monto de inversión/)).toBeVisible();
  });

  it("3. US04: el selector de instrumento cambia de pantalla en ambos sentidos", async () => {
    api();
    abrir("/simular/ahorros");
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("radio", { name: "Depósito a Plazo Fijo" }));
    expect(window.location.pathname).toBe("/simular/plazo-fijo");
    expect(screen.getByRole("heading", { level: 1, name: "Simula tu depósito a plazo fijo" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Monto de inversión/)).toBeVisible();
    await userEvent.click(screen.getByRole("radio", { name: "Cuenta de Ahorros" }));
    expect(window.location.pathname).toBe("/simular/ahorros");
    expect(screen.getByRole("heading", { level: 1, name: "Simula tu cuenta de ahorros" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("4. solo el enlace de la ruta actual lleva aria-current", () => {
    api();
    abrir("/planes");
    const nav = navPrincipal();
    expect(within(nav).getByRole("link", { name: "Planes" })).toHaveAttribute("aria-current", "page");
    for (const nombre of ["Inicio", "Ahorros", "Plazo fijo"]) {
      expect(within(nav).getByRole("link", { name: nombre })).not.toHaveAttribute("aria-current");
    }
  });

  it("5. la cabecera cambia con la sesión y 'Cerrar sesión' vuelve al estado anónimo", async () => {
    api();
    abrir("/");
    const cuenta = () => screen.getByRole("navigation", { name: "Cuenta" });
    expect(within(cuenta()).getByRole("link", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(within(cuenta()).getByRole("link", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mi perfil" })).not.toBeInTheDocument();

    act(() => iniciarSesion("BASICO"));
    expect(within(cuenta()).getByText("Plan: BASICO")).toBeInTheDocument();
    expect(within(cuenta()).getByRole("link", { name: "Mis favoritos" })).toBeInTheDocument();
    expect(within(cuenta()).getByRole("link", { name: "Mi perfil" })).toBeInTheDocument();

    await userEvent.click(within(cuenta()).getByRole("button", { name: "Cerrar sesión" }));
    expect(window.location.pathname).toBe("/login");
    await userEvent.click(screen.getByRole("link", { name: "Volver al inicio" }));
    expect(within(cuenta()).getByRole("link", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.queryByText("Plan: BASICO")).not.toBeInTheDocument();
  });

  it("6. las pantallas de acceso no tienen la cabecera completa y registro usa la tarjeta del login", () => {
    api();
    const { unmount } = abrir("/login");
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Yupay Finance" })).toHaveAttribute("href", "/");
    unmount();
    const { container } = abrir("/registro");
    expect(screen.queryByRole("navigation", { name: "Navegación principal" })).not.toBeInTheDocument();
    const tarjeta = container.querySelector("section.login-tarjeta") as HTMLElement;
    expect(within(tarjeta).getByRole("heading", { name: "Crea tu cuenta" })).toBeInTheDocument();
  });

  it("7. una ruta inexistente muestra la página no encontrada", async () => {
    api();
    abrir("/no-existe");
    expect(screen.getByRole("heading", { name: "No encontramos esta página" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Volver a Inicio" }));
    expect(window.location.pathname).toBe("/");
  });

  it("8. atrás y adelante del navegador actualizan la pantalla", async () => {
    api();
    abrir("/");
    await userEvent.click(within(navPrincipal()).getByRole("link", { name: "Planes" }));
    expect(await screen.findByRole("heading", { name: "Compara los planes" })).toBeInTheDocument();
    act(() => { window.history.replaceState(null, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(screen.getByRole("heading", { name: "Compara dónde guardar tu dinero" })).toBeInTheDocument();
  });

  it.each(["/", "/planes", "/simular/plazo-fijo"])("9. US24: el glosario se abre desde la cabecera en %s", async (ruta) => {
    api();
    abrir(ruta);
    await userEvent.click(screen.getByRole("button", { name: "Glosario financiero" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("10. US29: 'Volver a simular' un plazo fijo lleva a su pantalla con los datos cargados", async () => {
    const fetchMock = api();
    iniciarSesion("PRO");
    abrir("/");
    await userEvent.click(screen.getByRole("link", { name: "Mis favoritos" }));
    await userEvent.click(await screen.findByRole("button", { name: "Volver a simular" }));
    expect(window.location.pathname).toBe("/simular/plazo-fijo");
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/simulations/fixed-deposits"))).toBe(true));
    expect(screen.getByLabelText(/Monto de inversión/)).toHaveValue("1500.00");
  });

  it("11. la cancelación vive en Mi suscripción y ya no en el checkout", async () => {
    api();
    iniciarSesion("PRO");
    const { unmount } = abrir("/suscripcion");
    expect(screen.getByRole("button", { name: "Cancelar suscripción" })).toBeInTheDocument();
    unmount();
    abrir("/checkout");
    await screen.findByLabelText("Nombre o razón social");
    expect(screen.queryByRole("heading", { name: "Tu suscripción Pro" })).not.toBeInTheDocument();
  });

  it("11b. un usuario Básico en Mi suscripción ve la invitación al Plan Pro", async () => {
    api();
    iniciarSesion("BASICO");
    abrir("/suscripcion");
    expect(screen.getByText("Plan Básico · S/ 0.00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Conocer el Plan Pro" }));
    expect(window.location.pathname).toBe("/planes");
  });

  it("perfil enlaza a Mi suscripción", async () => {
    api();
    iniciarSesion("PRO");
    abrir("/perfil");
    await userEvent.click(screen.getByRole("button", { name: "Mi suscripción" }));
    expect(screen.getByRole("heading", { level: 1, name: "Mi suscripción" })).toBeInTheDocument();
  });
});

describe("US31: precio del Plan Pro (S/ 9.90 al mes)", () => {
  it("14. se muestra en planes, checkout, paywall y Mi suscripción", async () => {
    api();
    const planes = abrir("/planes");
    expect(await screen.findByText("S/ 9.90 al mes")).toBeInTheDocument();
    expect(screen.getByText("S/ 0.00")).toBeInTheDocument();
    planes.unmount();

    const checkout = abrir("/checkout");
    expect(await screen.findByText("S/ 9.90 / mes")).toBeInTheDocument();
    expect(screen.getByText("Total a pagar hoy: S/ 9.90")).toBeInTheDocument();
    checkout.unmount();

    const paywall = render(<PaywallModal open onClose={vi.fn()} onViewPlans={vi.fn()} />);
    expect(within(screen.getByRole("dialog")).getByText("Por solo S/ 9.90 al mes.")).toBeInTheDocument();
    paywall.unmount();

    iniciarSesion("PRO");
    abrir("/suscripcion");
    expect(screen.getByText("Plan Pro · S/ 9.90 al mes")).toBeInTheDocument();
  });

  it("15. la copia del frontend coincide con el precio que define el backend", async () => {
    // Se arma la respuesta de /api/plans con los datos reales del backend (backend/src/plans/Plan.ts).
    const backend = await import("../../../backend/src/plans/Plan");
    expect(PRO_MONTHLY_PRICE).toBe(backend.PRO_MONTHLY_PRICE);
    expect(backend.PLANS.find((plan) => plan.id === "PRO")?.price).toBe(PRO_MONTHLY_PRICE);
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ plans: backend.PLANS, features: backend.PLAN_FEATURES })));
    render(<PlanComparison onCheckout={vi.fn()} />);
    expect(await screen.findByText(`S/ ${PRO_MONTHLY_PRICE} al mes`)).toBeInTheDocument();
  });
});
