/// <reference types="node" />
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { once } from "node:events";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import App from "../App";

let server: ChildProcess;
let endpoint: string;
// US33: JWT reales firmados por el fixture (un usuario por prueba que cambia de plan).
let tokens: { pro: string; basic: string; declineThenApprove: string; upgrade: string };
const realFetch = globalThis.fetch;

beforeAll(async () => {
  const backend = resolve(process.cwd(), "..", "backend");
  server = spawn(process.execPath, ["--import", "tsx", "tests/sprint3/fixtures/integrationServer.ts"], {
    cwd: backend,
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe", "ipc"],
    env: { ...process.env, NODE_ENV: "test" },
  });
  let details = "";
  server.stderr?.on("data", (chunk) => { details += String(chunk); });
  endpoint = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("El backend de integración no inició. " + details)), 15000);
    server.once("message", (message: { port: number; tokens: typeof tokens }) => {
      clearTimeout(timeout);
      tokens = message.tokens;
      resolve(`http://127.0.0.1:${message.port}`);
    });
    server.once("error", (error) => { clearTimeout(timeout); reject(error); });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`El backend terminó con ${code}. ${details}`));
    });
  });
}, 20000);

afterAll(async () => {
  if (!server || server.exitCode !== null) return;
  const exited = once(server, "exit");
  server.send("stop");
  await exited;
});
afterEach(() => window.history.replaceState(null, "", "/"));

function connectAs(token: string) {
  const requests: { path: string; body: unknown }[] = [];
  // Solo se adapta el origen y la identidad del fixture. Las respuestas provienen de Express y SQLite reales.
  vi.stubGlobal("fetch", (input: string, options?: RequestInit) => {
    const path = new URL(input, "http://localhost:3000");
    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (options?.body) requests.push({ path: path.pathname, body: JSON.parse(String(options.body)) });
    return realFetch(`${endpoint}${path.pathname}${path.search}`, { ...options, headers });
  });
  return requests;
}

const futureExpiry = `12/${String(new Date().getFullYear() + 2).slice(-2)}`;
async function fillDemoCheckout(cardNumber = "0000111122223333", decline = false) {
  await userEvent.type(screen.getByLabelText("Nombre o razón social"), "Prueba de integración");
  await userEvent.type(screen.getByLabelText("Correo de facturación"), "integracion@example.com");
  await userEvent.type(screen.getByLabelText("Nombre del titular"), "Titular ficticio");
  await userEvent.type(screen.getByLabelText("Número de tarjeta"), cardNumber);
  await userEvent.type(screen.getByLabelText("Fecha de vencimiento"), futureExpiry);
  await userEvent.type(screen.getByLabelText("CVV"), "456");
  if (decline) await userEvent.click(screen.getByRole("checkbox", { name: "Forzar pago rechazado" }));
}

describe("Sprint 3, frontend con Express y SQLite reales", () => {
  it("guarda desde la tabla, visita planes y aprueba una transacción DEMO mediante HTTP", async () => {
    const requests = connectAs(tokens.pro);
    render(<App />);
    const buttons = await screen.findAllByRole("button", { name: /Guardar favorito de/ });
    await userEvent.click(buttons[0]);
    expect(await screen.findByText("Simulación guardada como favorita.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Planes" }));
    await screen.findByRole("columnheader", { name: "Pro" });
    await userEvent.click(screen.getByRole("link", { name: "Inicio" }));
    const repeatedButtons = await screen.findAllByRole("button", { name: /Guardar favorito de/ });
    await userEvent.click(repeatedButtons[0]);
    expect(await screen.findByText("Esta simulación ya estaba guardada.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Planes" }));
    await screen.findByRole("columnheader", { name: "Pro" });
    await userEvent.click(screen.getByRole("button", { name: "Continuar al checkout Pro" }));
    await screen.findByLabelText("Nombre o razón social");
    await fillDemoCheckout();
    await userEvent.click(screen.getByRole("button", { name: "Pagar ahora" }));
    expect(await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" })).toBeInTheDocument();
    expect(screen.getByText(/^[A-F0-9]{24}$/)).toBeInTheDocument();
    const submitted = requests.filter((request) => request.path === "/api/checkout/simulate");
    expect(submitted).toEqual([{ path: "/api/checkout/simulate", body: {
      planId: "PRO", scenarioId: "DEMO_APPROVED", billing: { name: "Prueba de integración", email: "integracion@example.com" },
    } }]);
    expect(JSON.stringify(submitted)).not.toMatch(/0000111122223333|Titular ficticio|cvv|cardNumber/i);
  });

  it("aplica por HTTP la restricción Básica y ofrece acceder a planes", async () => {
    connectAs(tokens.basic);
    render(<App />);
    const buttons = await screen.findAllByRole("button", { name: /Guardar favorito de/ });
    await userEvent.click(buttons[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("requiere el Plan Pro");
    await userEvent.click(screen.getByRole("button", { name: "Comparar planes" }));
    expect(await screen.findByRole("heading", { name: "Compara los planes" })).toBeInTheDocument();
  });

  async function goToCheckout() {
    render(<App />);
    await userEvent.click(screen.getByRole("link", { name: "Planes" }));
    await screen.findByRole("columnheader", { name: "Pro" });
    await userEvent.click(screen.getByRole("button", { name: "Continuar al checkout Pro" }));
    await screen.findByLabelText("Nombre o razón social");
  }

  it("sin sesión el pago responde 401, pide iniciar sesión y conserva la protección de favoritos", async () => {
    connectAs("unrecognized-demo-visitor");
    await goToCheckout();
    await fillDemoCheckout();
    await userEvent.click(screen.getByRole("button", { name: "Pagar ahora" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Inicia sesión para suscribirte al Plan Pro.");
    expect(screen.queryByRole("heading", { name: "¡Bienvenido al Plan Pro!" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a planes" }));
    await userEvent.click(screen.getByRole("link", { name: "Inicio" }));
    const favoriteButtons = await screen.findAllByRole("button", { name: /Guardar favorito de/ });
    await userEvent.click(favoriteButtons[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Inicia sesión");
  });

  it("un rechazo DEMO autenticado muestra el motivo y permite intentar nuevamente con aprobación", async () => {
    const requests = connectAs(tokens.declineThenApprove);
    await goToCheckout();
    await fillDemoCheckout(undefined, true);
    await userEvent.click(screen.getByRole("button", { name: "Pagar ahora" }));
    expect(await screen.findByRole("heading", { name: "No pudimos procesar tu pago" })).toBeInTheDocument();
    expect(screen.getByText(/Fondos insuficientes./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Intentar nuevamente" }));
    await fillDemoCheckout();
    await userEvent.click(screen.getByRole("button", { name: "Pagar ahora" }));
    expect(await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" })).toBeInTheDocument();
    expect(requests.filter((request) => request.path === "/api/checkout/simulate").map((request) => request.body)).toEqual([
      { planId: "PRO", scenarioId: "DEMO_DECLINED", billing: { name: "Prueba de integración", email: "integracion@example.com" } },
      { planId: "PRO", scenarioId: "DEMO_APPROVED", billing: { name: "Prueba de integración", email: "integracion@example.com" } },
    ]);
  });

  it("US33: una aprobación DEMO activa el Plan Pro de una identidad Básica y desbloquea favoritos", async () => {
    connectAs(tokens.upgrade);
    await goToCheckout();
    await fillDemoCheckout();
    await userEvent.click(screen.getByRole("button", { name: "Pagar ahora" }));
    expect(await screen.findByRole("heading", { name: "¡Bienvenido al Plan Pro!" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a la aplicación" }));
    expect(window.location.pathname).toBe("/");
    const favoriteButtons = await screen.findAllByRole("button", { name: /Guardar favorito de/ });
    await userEvent.click(favoriteButtons[0]);
    expect(await screen.findByText("Simulación guardada como favorita.")).toBeInTheDocument();
  });
});
