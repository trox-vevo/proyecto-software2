import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthSession, saveAuthSession, type UserPlan } from "../auth/session";
import { sessionStore } from "../pro_access/SessionStore";
import { DownloadReportButton } from "./DownloadReportButton";
import type { ParametrosPlazoFijo } from "./tipos";

// US30 (Escenario 1, TS-95): botón exclusivo Pro con spinner y descarga nativa.
const parametros: ParametrosPlazoFijo = { amount: "1000", termDays: 360, department: "Lima", paymentMode: "AT_MATURITY" };
const login = (plan: UserPlan) => saveAuthSession({
  id: "s1", userId: 2, tokenJwt: "token-pro", expiresAt: new Date(Date.now() + 3_600_000).toISOString(), plan,
});
const pdfResponse = () => new Response("%PDF-1.3", { status: 200, headers: { "Content-Type": "application/pdf" } });
const button = () => screen.getByRole("button", { name: /Descargar Reporte PDF|Preparando tu reporte/ });

let downloads: string[];
beforeEach(() => {
  downloads = [];
  // jsdom no implementa estas funciones ni la descarga de un enlace.
  URL.createObjectURL = vi.fn(() => "blob:reporte");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(() => { clearAuthSession(); vi.restoreAllMocks(); });

describe("US30, DownloadReportButton", () => {
  it("no se muestra a un usuario Básico", () => {
    login("BASICO");
    render(<DownloadReportButton parametros={parametros} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("se muestra a un usuario Pro", () => {
    login("PRO");
    render(<DownloadReportButton parametros={parametros} />);
    expect(screen.getByRole("button", { name: "Descargar Reporte PDF" })).toBeEnabled();
  });

  it("muestra el spinner y deshabilita el botón mientras se prepara; un doble clic hace una sola petición", async () => {
    login("PRO");
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DownloadReportButton parametros={parametros} />);
    await userEvent.dblClick(button());
    expect(screen.getByRole("status")).toHaveTextContent("Preparando tu reporte…");
    expect(button()).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => finish(pdfResponse()));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(downloads).toEqual(["ReporteSolvencia.pdf"]);
  });

  it("envía los parámetros con el token y descarga ReporteSolvencia.pdf", async () => {
    login("PRO");
    const fetchMock = vi.fn(async () => pdfResponse());
    vi.stubGlobal("fetch", fetchMock);
    render(<DownloadReportButton parametros={parametros} />);
    await userEvent.click(button());
    await screen.findByRole("button", { name: "Descargar Reporte PDF" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/reports\/solvency$/);
    expect(request.method).toBe("POST");
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer token-pro");
    expect(JSON.parse(String(request.body))).toEqual(parametros);
    expect(downloads).toEqual(["ReporteSolvencia.pdf"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:reporte");
  });

  it("con 403 explica que el Plan Pro no está activo y deja de tratarlo como Pro", async () => {
    login("PRO");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Exclusivo Plan Pro" }), { status: 403 })));
    render(<DownloadReportButton parametros={parametros} />);
    await userEvent.click(button());
    expect(await screen.findByRole("alert")).toHaveTextContent("Tu Plan Pro no está activo");
    expect(sessionStore.isPro()).toBe(false);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it.each([
    ["un error de red", () => Promise.reject(new TypeError("network"))],
    ["un error del servidor", async () => new Response("{}", { status: 500 })],
  ])("con %s muestra un mensaje amigable", async (_case, response) => {
    login("PRO");
    vi.stubGlobal("fetch", vi.fn(response));
    render(<DownloadReportButton parametros={parametros} />);
    await userEvent.click(button());
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos preparar tu reporte. Inténtalo de nuevo.");
    expect(downloads).toEqual([]);
  });
});
