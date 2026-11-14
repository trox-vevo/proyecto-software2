import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveAuthSession, type AuthSession } from "../auth/session";
import { NotificationPreferences } from "./NotificationPreferences";

const session: AuthSession = {
  id: "session-pro",
  userId: 7,
  tokenJwt: "token-pro",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  plan: "PRO",
};

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("NotificationPreferences", () => {
  it("carga y persiste tipos de alerta y frecuencia para un usuario Pro", async () => {
    saveAuthSession(session);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return new Response(init.body);
      }
      return new Response(JSON.stringify({
        alertTypes: ["CAMBIO_TASA", "CAMBIO_RIESGO"],
        frequency: "INMEDIATA",
      }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<NotificationPreferences />);

    const user = userEvent.setup();
    const riskAlert = await screen.findByRole("checkbox", { name: "Cambios en nivel de riesgo" });
    await user.click(riskAlert);
    await user.selectOptions(screen.getByLabelText("Frecuencia"), "RESUMEN_DIARIO");
    await user.click(screen.getByRole("button", { name: "Guardar preferencias" }));

    expect(await screen.findByText(
      "Tus preferencias de notificación han sido actualizadas.",
    )).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect(url).toContain("/api/notifications/preferences");
    expect(init).toMatchObject({
      method: "PUT",
      body: JSON.stringify({
        alertTypes: ["CAMBIO_TASA"],
        frequency: "RESUMEN_DIARIO",
      }),
    });
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("bloquea la configuración y muestra la explicación para un usuario Básico", async () => {
    saveAuthSession({ ...session, plan: "BASICO" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<NotificationPreferences />);

    expect(await screen.findByText(
      "Esta función está disponible solo para usuarios Pro. Actualiza tu plan para personalizar tus alertas.",
    )).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar preferencias" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exige elegir al menos un tipo de alerta antes de guardar", async () => {
    saveAuthSession(session);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      alertTypes: ["CAMBIO_TASA", "CAMBIO_RIESGO"],
      frequency: "INMEDIATA",
    })));
    vi.stubGlobal("fetch", fetchMock);
    render(<NotificationPreferences />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: "Cambios en tasas de interés" }));
    await user.click(screen.getByRole("checkbox", { name: "Cambios en nivel de riesgo" }));
    await user.click(screen.getByRole("button", { name: "Guardar preferencias" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Selecciona al menos un tipo de alerta.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
