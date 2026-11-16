import Decimal from "decimal.js";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CuentaAhorros } from "../../src/rentabilidad/CuentaAhorros";
import { FiltroAhorros } from "../../src/rentabilidad/FiltroAhorros";
import { SbsRiskProfile } from "../../src/risk/domain/SbsRiskProfile";
import { riskLevelFromRating } from "../../src/risk/domain/riskLevelFromRating";
import { createAhorrosRouter } from "../../src/routes/ahorros";
import { DigitalChannels } from "../../src/simulation/domain/DigitalChannels";
import { ServiceChannels } from "../../src/simulation/domain/ServiceChannels";

// US08/US09/US13 y US22/US23: datos propios del test (no dependen de cuentas.json ni del seed).
const cuenta = (id: string, entityId: number | null, departamento: string | null, montoMinimo: string, tasa = "0.05") =>
  new CuentaAhorros(id, "Prueba", "1000", tasa, new Date("2024-01-01"), "0", new ServiceChannels(true, true), undefined,
    new DigitalChannels(true, true), entityId, entityId === null ? null : `Entidad ${entityId}`, departamento, montoMinimo);

const cuentas = [
  cuenta("L-1", 1, "Lima", "0.00", "0.05"),
  cuenta("L-2", 2, "Lima", "500.00", "0.08"),
  cuenta("C-1", 3, "Cusco", "0.00", "0.04"),
  cuenta("S-1", null, null, "0.00", "0.01"),
];
const perfil = (entityId: number, rating: string) =>
  new SbsRiskProfile(entityId, `Entidad ${entityId}`, rating, new Decimal("0.15"), new Decimal("0.03"), new Decimal("0.25"), new Date("2026-09-30"), "https://www.sbs.gob.pe/");
const ratings: Record<number, string> = { 1: "A+", 2: "C" }; // la entidad 3 no tiene datos SBS

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use("/api/ahorros", createAhorrosRouter(
    { obtenerTodas: () => cuentas },
    { findByEntityId: (id) => (ratings[id] ? perfil(id, ratings[id]) : null) },
  ));
  server = app.listen(0);
  await once(server, "listening");
  base = `http://localhost:${(server.address() as AddressInfo).port}/api/ahorros/rentabilidad`;
});
afterAll(() => { server.close(); });

const buscar = async (query: string) => {
  const response = await fetch(`${base}${query}`);
  return { status: response.status, body: await response.json() };
};
type Fila = { cuentaId: string; capitalInicial: string; tasaAnual: string; montoMinimo: string; riesgo: { nivel: string } | null };
const ids = (filas: Fila[]) => filas.map((fila) => fila.cuentaId).sort();

describe("GET /api/ahorros/rentabilidad: búsqueda por monto y departamento", () => {
  it("sin monto ni departamento devuelve todas las cuentas con su saldo propio (comportamiento anterior)", async () => {
    const { status, body } = await buscar("");
    expect(status).toBe(200);
    expect(ids(body.resultados)).toEqual(["C-1", "L-1", "L-2", "S-1"]);
    expect(body.resultados.every((fila: Fila) => fila.capitalInicial === "1,000.00")).toBe(true);
  });

  it("con monto, cada cuenta se simula con el monto del usuario", async () => {
    const { body } = await buscar("?monto=2500.50");
    expect(body.resultados.every((fila: Fila) => fila.capitalInicial === "2,500.50")).toBe(true);
  });

  it("filtra por departamento", async () => {
    expect(ids((await buscar("?departamento=Cusco")).body.resultados)).toEqual(["C-1"]);
    expect(ids((await buscar("?departamento=Lima")).body.resultados)).toEqual(["L-1", "L-2"]);
  });

  it("excluye las cuentas cuyo monto mínimo es mayor que el monto (US13)", async () => {
    expect(ids((await buscar("?monto=499.99&departamento=Lima")).body.resultados)).toEqual(["L-1"]);
    expect(ids((await buscar("?monto=500&departamento=Lima")).body.resultados)).toEqual(["L-1", "L-2"]);
  });

  it("sin coincidencias devuelve [] (el frontend muestra el zero-state)", async () => {
    const { status, body } = await buscar("?departamento=Arequipa");
    expect(status).toBe(200);
    expect(body.resultados).toEqual([]);
  });

  it.each(["abc", "0", "-5", "1.234", "1e3"])("monto=%s inválido responde 400 con mensaje claro", async (monto) => {
    const { status, body } = await buscar(`?monto=${monto}`);
    expect(status).toBe(400);
    expect(body.error).toMatch(/monto/);
  });

  it("agrega tasaAnual y montoMinimo a cada fila", async () => {
    const fila = (await buscar("?departamento=Lima")).body.resultados.find((item: Fila) => item.cuentaId === "L-2");
    expect(fila.tasaAnual).toBe("0.08");
    expect(fila.montoMinimo).toBe("500.00");
  });

  it("US22/US23: el semáforo sale de la calificación SBS de la entidad (solo el color)", async () => {
    const filas: Fila[] = (await buscar("")).body.resultados;
    const riesgo = Object.fromEntries(filas.map((fila) => [fila.cuentaId, fila.riesgo]));
    expect(riesgo).toEqual({ "L-1": { nivel: "VERDE" }, "L-2": { nivel: "ROJO" }, "C-1": null, "S-1": null });
    expect(JSON.stringify(filas)).not.toMatch(/riskRating|"A\+"/);
  });
});

describe("riskLevelFromRating (misma regla que frontend/src/risk/nivelDeCalificacion.ts)", () => {
  it.each([["A+", "VERDE"], ["A", "VERDE"], ["A-", "AMARILLO"], ["B+", "AMARILLO"], ["B", "AMARILLO"], ["B-", "AMARILLO"],
    ["C", "ROJO"], ["D+", "ROJO"], ["E", "ROJO"], ["", null], ["AAA", null]])("%s -> %s", (rating, nivel) => {
    expect(riskLevelFromRating(rating)).toBe(nivel);
  });
});

describe("FiltroAhorros: departamento y monto disponible", () => {
  it("sin los criterios nuevos no filtra nada", () => {
    expect(new FiltroAhorros().aplicar(cuentas)).toHaveLength(4);
  });
  it("una cuenta sin departamento no aparece al filtrar por departamento", () => {
    expect(new FiltroAhorros({ departamento: "Lima" }).aplicar(cuentas).map((c) => c.id)).toEqual(["L-1", "L-2"]);
  });
  it("el monto mínimo igual al monto disponible sí pasa", () => {
    expect(new FiltroAhorros({ montoDisponible: "500" }).aplicar(cuentas).map((c) => c.id)).toContain("L-2");
    expect(new FiltroAhorros({ montoDisponible: "499.99" }).aplicar(cuentas).map((c) => c.id)).not.toContain("L-2");
  });
});
