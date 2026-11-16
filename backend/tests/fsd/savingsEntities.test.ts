import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RepositorioCuentas } from "../../src/repositorio/RepositorioCuentas";
import { RepositorioCuentasSqlite } from "../../src/repositorio/RepositorioCuentasSqlite";
import { CriterioOrden } from "../../src/rentabilidad/CriterioOrden";
import { MotorCalculo } from "../../src/rentabilidad/MotorCalculo";
import { FiltroAhorros } from "../../src/rentabilidad/FiltroAhorros";
import { FormateadorResultados } from "../../src/rentabilidad/FormateadorResultados";
import { RentabilidadSimple } from "../../src/rentabilidad/RentabilidadSimple";
import { RentabilidadCompuesta } from "../../src/rentabilidad/RentabilidadCompuesta";
import { createAhorrosRouter } from "../../src/routes/ahorros";
import { openDatabase } from "../../src/shared/infrastructure/openDatabase";

let db: DatabaseSync;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
  db = openDatabase(":memory:");
});
afterEach(() => { db.close(); vi.useRealTimers(); });

describe("US21: ahorro obtiene FSD de su entidad", () => {
  it("asocia las seis cuentas sin cambiar ID ni titular y devuelve cuatro verificadas y dos no verificadas", () => {
    const accounts = new RepositorioCuentasSqlite(db).obtenerTodas();
    expect(accounts.map((account) => [account.id, account.entityId, account.entityName])).toEqual([
      ["AH-001", 1, "Banco de Crédito del Perú (BCP)"], ["AH-002", 2, "BBVA Perú"], ["AH-003", 3, "Interbank"],
      ["AH-004", 4, "Scotiabank Perú"], ["AH-005", 5, "Cooperativa Abaco"], ["AH-006", 6, "Cooperativa Pacífico"],
    ]);
    expect(accounts.map((account) => account.titular)).toEqual(["Ana Torres", "Beto Quispe", "Carla Rojas", "Diego Salas", "Elena Vargas", "Fabio Medina"]);
    expect(accounts.map((account) => account.coberturaFSD.estado)).toEqual(["CUBIERTO", "CUBIERTO", "CUBIERTO", "CUBIERTO", "NO_VERIFICADO", "NO_VERIFICADO"]);
  });

  it.each([new RentabilidadSimple(), new RentabilidadCompuesta()])("conserva importes, orden, filtros y canales con %s", (algorithm) => {
    const motor = new MotorCalculo(algorithm, new FiltroAhorros({ saldoMinimo: "500" }), new FormateadorResultados());
    const actual = new RepositorioCuentasSqlite(db).obtenerTodas();
    const original = new RepositorioCuentas().obtenerTodas();
    for (const days of [1, 30, 365]) for (const criterion of Object.values(CriterioOrden)) {
      const strip = (rows: unknown[]) => rows.map((row) => Object.fromEntries(Object.entries(row as object).filter(([key]) => !["entityId", "entityName", "coberturaFSD"].includes(key))));
      expect(strip(motor.calcular(actual, days, criterion))).toEqual(strip(motor.calcular(original, days, criterion)));
    }
  });

  it("refleja cambios y caducidad de evidencia sin copiarla al registro de ahorro", () => {
    const repo = new RepositorioCuentasSqlite(db);
    const before = db.prepare("SELECT * FROM savings_accounts ORDER BY id").all();
    expect(repo.obtenerTodas()[0].coberturaFSD.estado).toBe("CUBIERTO");
    db.exec("UPDATE financial_entities SET fsd_coverage = NULL WHERE id = 1");
    expect(repo.obtenerTodas()[0].coberturaFSD.estado).toBe("NO_VERIFICADO");
    vi.setSystemTime(new Date("2026-11-23T00:00:00Z"));
    expect(repo.obtenerTodas().every((account) => account.coberturaFSD.estado === "NO_VERIFICADO")).toBe(true);
    expect(db.prepare("SELECT * FROM savings_accounts ORDER BY id").all()).toEqual(before);
  });

  it.each(["{JSON roto", JSON.stringify({ estado: "CUBIERTO", entidadFinanciera: "Otra entidad", fechaVerificacion: "2026-11-15", vigenteHasta: "2026-11-22", fuente: "https://fsd.org.pe/miembros/" })])("no atribuye evidencia inválida o de otra entidad: %s", (raw) => {
    db.prepare("UPDATE financial_entities SET fsd_coverage = ? WHERE id = 1").run(raw);
    const accounts = new RepositorioCuentasSqlite(db).obtenerTodas();
    expect(accounts).toHaveLength(6);
    expect(accounts[0]).toMatchObject({ entityName: "Banco de Crédito del Perú (BCP)", coberturaFSD: { estado: "NO_VERIFICADO" } });
  });

  it("no utiliza una cobertura antigua de la cuenta ni pierde cuentas sin asociación", () => {
    db.prepare("UPDATE savings_accounts SET fsd_coverage = (SELECT fsd_coverage FROM financial_entities WHERE id = 1) WHERE id = 'AH-005'").run();
    db.exec("DELETE FROM savings_account_entities WHERE account_id = 'AH-006'");
    const accounts = new RepositorioCuentasSqlite(db).obtenerTodas();
    expect(accounts).toHaveLength(6);
    expect(accounts[4].coberturaFSD.estado).toBe("NO_VERIFICADO");
    expect(accounts[5]).toMatchObject({ entityId: null, entityName: null, coberturaFSD: { estado: "NO_VERIFICADO" } });
  });

  it("sirve identidad y FSD por HTTP conservando la selección por accountId", async () => {
    const app = express();
    app.use("/api/ahorros", createAhorrosRouter(new RepositorioCuentasSqlite(db)));
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ahorros/rentabilidad`;
      const response = await fetch(base + "?accountId=AH-001&dias=365");
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.resultados).toHaveLength(1);
      expect(body.resultados[0]).toMatchObject({ cuentaId: "AH-001", entityId: 1, entityName: "Banco de Crédito del Perú (BCP)", capitalInicial: "1,000.00", interesGenerado: "50.00", coberturaFSD: { estado: "CUBIERTO" } });
      const coop = await (await fetch(base + "?accountId=AH-005")).json();
      expect(coop.resultados[0]).toMatchObject({ entityName: "Cooperativa Abaco", coberturaFSD: { estado: "NO_VERIFICADO" } });
    } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
