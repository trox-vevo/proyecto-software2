import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { saveAuthSession, type AuthSession } from "../auth/session";
import { SubscriptionStatusBanner } from "./SubscriptionStatusBanner";

const session: AuthSession = {
  id: "session-id",
  userId: 7,
  tokenJwt: "token",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  plan: "PRO",
  planExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  planCancellationRequested: true,
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("TS-132, banner de cancelación de suscripción", () => {
  it("informa la fecha de término y los beneficios que se conservan", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      plan: "PRO",
      planExpiresAt: session.planExpiresAt,
      planCancellationRequested: true,
      history: [],
    }))));
    saveAuthSession(session);
    render(<SubscriptionStatusBanner />);

    const banner = screen.getByRole("status", { name: "Estado de suscripción" });
    expect(banner).toHaveTextContent("Cancelación programada.");
    expect(banner).toHaveTextContent("Después conservarás las funciones del plan Básico.");
    expect(banner.querySelector("time")).toHaveAttribute("datetime", session.planExpiresAt);
  });

  it("se actualiza al recibir una cancelación programada y se oculta para Básico o período vencido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      plan: "PRO",
      planExpiresAt: session.planExpiresAt,
      planCancellationRequested: true,
      history: [],
    }))));
    saveAuthSession({ ...session, planCancellationRequested: false });
    render(<SubscriptionStatusBanner />);
    expect(screen.queryByRole("status", { name: "Estado de suscripción" })).not.toBeInTheDocument();

    await act(async () => saveAuthSession(session));
    expect(screen.getByRole("status", { name: "Estado de suscripción" })).toBeInTheDocument();

    await act(async () => saveAuthSession({ ...session, plan: "BASICO" }));
    expect(screen.queryByRole("status", { name: "Estado de suscripción" })).not.toBeInTheDocument();

    await act(async () => saveAuthSession({ ...session, planExpiresAt: new Date(Date.now() - 1).toISOString() }));
    await waitFor(() => expect(screen.queryByRole("status", { name: "Estado de suscripción" })).not.toBeInTheDocument());
  });

  it("muestra la causa del cambio y permite consultar el historial", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      plan: "BASICO",
      planExpiresAt: null,
      planCancellationRequested: false,
      history: [{
        id: 1,
        fromPlan: "PRO",
        toPlan: "BASICO",
        reason: "RENEWAL_PAYMENT_FAILED",
        changedAt: "2026-02-05T12:00:00.000Z",
        planExpiresAt: "2026-03-01T12:00:00.000Z",
      }],
    }))));
    saveAuthSession({ ...session, plan: "PRO" });
    render(<SubscriptionStatusBanner />);

    expect(await screen.findByText(/fallo en el pago de renovación/)).toBeInTheDocument();
    expect(screen.getByText("Tu historial de cambios de plan")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Consultar historial/));
    expect(screen.getByText(/pago de renovación rechazado/)).toBeInTheDocument();
  });
});
