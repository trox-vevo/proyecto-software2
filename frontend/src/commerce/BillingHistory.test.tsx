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
        amount: "9.90",
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
    expect(within(table).getByText("9.90")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Descargar recibo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver a mi cuenta" })).not.toBeInTheDocument();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/checkout/history");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer signed-test-token");
  });

  it("muestra 'No disponible' en el monto de los pagos anteriores al precio (amount null)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      transactions: [{
        reference, outcome: "APPROVED", occurredAt: "2026-11-10T12:00:00.000Z",
        planId: "PRO", amount: null, currency: "PEN", receiptStatus: "AVAILABLE",
      }],
    })));
    render(<BillingHistory />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("No disponible")).toBeInTheDocument();
  });

  it("rechaza un monto numérico (debe viajar como texto con 2 decimales)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      transactions: [{
        reference, outcome: "APPROVED", occurredAt: "2026-11-10T12:00:00.000Z",
        planId: "PRO", amount: 9.9, currency: "PEN", receiptStatus: "AVAILABLE",
      }],
    })));
    render(<BillingHistory />);
    expect(await screen.findByRole("alert")).toHaveTextContent("historial de facturación inválido");
  });

  it("presenta claramente cuando todavía no hay transacciones", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ transactions: [] })));
    render(<BillingHistory />);
    expect(await screen.findByText("No tienes transacciones de facturación todavía.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
