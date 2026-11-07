import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth, getStoredSession, saveAuthSession, type AuthSession } from "./session";

const session: AuthSession = {
  id: "session-id",
  userId: 42,
  tokenJwt: "token-valido",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  plan: "PRO",
};

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("sesión de autenticación", () => {
  it("lee una sesión válida del almacenamiento local", () => {
    saveAuthSession(session);
    expect(getStoredSession()).toEqual(session);
  });

  it("elimina una sesión expirada", () => {
    saveAuthSession({ ...session, expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(getStoredSession()).toBeNull();
    expect(localStorage.getItem("yupay.auth.session")).toBeNull();
  });

  it("agrega el bearer token sin reemplazar otros encabezados", async () => {
    saveAuthSession(session);
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithAuth("/api/perfil", { headers: { "X-Test": "preservado" } });

    const request = fetchMock.mock.calls[0];
    const headers = new Headers(request[1].headers);
    expect(headers.get("Authorization")).toBe("Bearer token-valido");
    expect(headers.get("X-Test")).toBe("preservado");
  });
});
