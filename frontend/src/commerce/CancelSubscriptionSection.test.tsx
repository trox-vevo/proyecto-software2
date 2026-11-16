import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAuthSession, saveAuthSession } from "../auth/session";
import { sessionStore } from "../pro_access/SessionStore";
import { CancelSubscriptionSection } from "./CancelSubscriptionSection";

// Movido desde Checkout.test.tsx: la cancelación ahora vive en "Mi suscripción".
// Sin el Checkout ya no hay petición previa de configuración, así que la petición de
// cancelación es la primera (calls[0]) y "no llamar al endpoint" es "ninguna llamada".
const cancellationResponse = (planExpiresAt: string) => new Response(JSON.stringify({
  status: "CANCELLATION_SCHEDULED",
  plan: "PRO",
  planExpiresAt,
  planCancellationRequested: true,
  message: "Tu suscripción Pro se cancelará al finalizar el período actual.",
}));
function open(fetchMock = vi.fn()) {
  vi.stubGlobal("fetch", fetchMock);
  render(<CancelSubscriptionSection />);
}

describe("TS-128/TS-130, cancelación de la suscripción Pro", () => {
  const proSession = () => saveAuthSession({
    id: "s1",
    userId: 7,
    tokenJwt: "token-pro",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    plan: "PRO",
    planExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    planCancellationRequested: false,
  });
  afterEach(() => clearAuthSession());

  it("pide confirmación, permite desistir y no llama al endpoint", async () => {
    proSession();
    const fetchMock = vi.fn();
    open(fetchMock);

    await userEvent.click(screen.getByRole("button", { name: "Cancelar suscripción" }));
    expect(screen.getByText(/¿Confirmas que quieres programar la cancelación/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mantener mi suscripción" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStore.isPro()).toBe(true);
    expect(screen.getByRole("button", { name: "Cancelar suscripción" })).toBeInTheDocument();
  });

  it("confirma la cancelación al final del período y mantiene Pro hasta esa fecha", async () => {
    proSession();
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(cancellationResponse(expiresAt));
    open(fetchMock);

    await userEvent.click(screen.getByRole("button", { name: "Cancelar suscripción" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cancelación" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Tu suscripción Pro se cancelará al finalizar el período actual.");
    expect(sessionStore.isPro()).toBe(true);
    expect(JSON.parse(localStorage.getItem("yupay.auth.session") ?? "{}")).toMatchObject({
      plan: "PRO",
      planExpiresAt: expiresAt,
      planCancellationRequested: true,
    });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/subscription/cancel");
    expect(request.method).toBe("POST");
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer token-pro");
  });

  it("no se muestra a un usuario Básico", () => {
    open();
    expect(screen.queryByRole("button", { name: "Cancelar suscripción" })).not.toBeInTheDocument();
  });
});
