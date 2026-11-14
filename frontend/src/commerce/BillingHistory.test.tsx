import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { clearAuthSession, saveAuthSession } from "../auth/session";
import { BillingHistory } from "./BillingHistory";

const reference = "DEMO-0123456789abcdef01234567";

beforeEach(() => {
  saveAuthSession({
    id: "session-test",
    userId: 7,
    tokenJwt: "signed-test-token",
    expiresAt: "2099-01-01T00:00:00.000Z",
    plan: "PRO",
  });
});

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("US34, historial de facturación", () => {
  it("muestra la tabla cronológica y envía la sesión al consultar el historial", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      transactions: [{
        reference,
        outcome: "APPROVED",
        occurredAt: "2026-11-10T12:00:00.000Z",
        planId: "PRO",
        amount: null,
        currency: "PEN",
        receiptStatus: "AVAILABLE",
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<BillingHistory />);

    const table = await screen.findByRole("table", { name: "Operaciones de facturación, de la más reciente a la más antigua" });
    expect(within(table).getByRole("columnheader", { name: "Fecha de cobro" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Estado de pago" })).toBeInTheDocument();
    expect(within(table).getByText("Suscripción Plan Pro")).toBeInTheDocument();
    expect(within(table).getByText("Sin cobro (DEMO)")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Descargar recibo" })).toBeInTheDocument();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/checkout/history");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer signed-test-token");
  });

  it("presenta claramente cuando todavía no hay transacciones", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ transactions: [] })));
    render(<BillingHistory />);
    expect(await screen.findByText("No tienes transacciones de facturación todavía.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
