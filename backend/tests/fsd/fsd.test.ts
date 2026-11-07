import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { crearCoberturaNoVerificada, validarCoberturaFSD } from "../../src/fsd/CoberturaFSD";
import { RepositorioCuentas } from "../../src/repositorio/RepositorioCuentas";
import { MotorCalculo } from "../../src/rentabilidad/MotorCalculo";
import { RentabilidadSimple } from "../../src/rentabilidad/RentabilidadSimple";
import { FiltroAhorros } from "../../src/rentabilidad/FiltroAhorros";
import { FormateadorResultados } from "../../src/rentabilidad/FormateadorResultados";
import { CriterioOrden } from "../../src/rentabilidad/CriterioOrden";
import { FinancialProduct } from "../../src/simulation/domain/FinancialProduct";
import { ServiceChannels } from "../../src/simulation/domain/ServiceChannels";
import { createApp } from "../../src/app";

// Evidencia ficticia exclusiva de pruebas. No acredita ninguna entidad real.
const hoy = new Date().toISOString().slice(0, 10);
const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const evidencia = { estado: "CUBIERTO", entidadFinanciera: "Entidad de prueba", fechaVerificacion: hoy, vigenteHasta: manana, fuente: "https://www.fsd.org.pe/" };

describe("US21: evidencia de cobertura FSD", () => {
  it("admite los dos estados explícitos con evidencia vigente", () => {
    expect(validarCoberturaFSD(evidencia).estado).toBe("CUBIERTO");
    expect(validarCoberturaFSD({ ...evidencia, estado: "NO_CUBIERTO" }).estado).toBe("NO_CUBIERTO");
  });
  it.each([
    undefined, null, true, {}, { estado: "CUBIERTO" },
    { ...evidencia, estado: "DESCONOCIDO" }, { ...evidencia, fuente: "https://ejemplo.com" },
    { ...evidencia, fuente: "http://www.fsd.org.pe/" }, { ...evidencia, fuente: "https://www.fsd.org.pe.ejemplo.com/" },
    { ...evidencia, fuente: "javascript:alert(1)" }, { ...evidencia, entidadFinanciera: " " },
    { ...evidencia, fechaVerificacion: "2999-01-01" }, { ...evidencia, vigenteHasta: "2020-01-01" },
    { ...evidencia, fechaVerificacion: "2026-02-30" }, { ...evidencia, vigenteHasta: null },
  ])("los datos incompletos, no oficiales o vencidos son no verificados: %j", (raw) => {
    expect(validarCoberturaFSD(raw).estado).toBe("NO_VERIFICADO");
  });
  it("propaga la evidencia desde JSON hasta la respuesta de ahorros sin alterar los importes", () => {
    const dir = mkdtempSync(join(tmpdir(), "yupay-fsd-"));
    try {
      const file = join(dir, "cuentas.json");
      writeFileSync(file, JSON.stringify([
        { id: "A", titular: "Prueba", saldo: "1000", tasaAnual: "0.05", fechaApertura: "2024-01-01", monthlyMaintenanceFee: "0", channels: { hasPhysicalBranches: false, hasAtms: false }, coberturaFSD: evidencia },
        { id: "B", titular: "Prueba", saldo: "1000", tasaAnual: "0.05", fechaApertura: "2024-01-01", monthlyMaintenanceFee: "0", channels: { hasPhysicalBranches: false, hasAtms: false } },
      ]));
      const cuentas = new RepositorioCuentas(file).obtenerTodas();
      const resultados = new MotorCalculo(new RentabilidadSimple(), new FiltroAhorros({}), new FormateadorResultados()).calcular(cuentas, 365, CriterioOrden.RENTABILIDAD);
      expect(resultados[0].coberturaFSD).toEqual(evidencia);
      expect(resultados[1].coberturaFSD).toEqual(crearCoberturaNoVerificada());
      expect(resultados[0].capitalInicial).toBe(resultados[1].capitalInicial);
      expect(resultados[0].interesGenerado).toBe(resultados[1].interesGenerado);
      expect(resultados[0].saldoFinal).toBe(resultados[1].saldoFinal);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("incluye FSD en ambas modalidades de plazo fijo y en la API de ahorros", async () => {
    const producto = new FinancialProduct(1, "Entidad de prueba", new Decimal("0.05"), new Decimal("500"), new ServiceChannels(false, false), evidencia);
    const server = createApp({ findFixedDepositsByDepartment: async () => [producto] }).listen(0);
    try {
      await once(server, "listening");
      const url = `http://localhost:${(server.address() as AddressInfo).port}`;
      for (const paymentMode of ["AT_MATURITY", "MONTHLY"]) {
        const response = await fetch(`${url}/api/simulations/fixed-deposits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: "1000", termDays: 360, department: "Lima", paymentMode }) });
        expect(response.status).toBe(200);
        expect((await response.json())[0].coberturaFSD).toEqual(evidencia);
      }
      const response = await fetch(`${url}/api/ahorros/rentabilidad`);
      const { resultados } = await response.json();
      expect(response.status).toBe(200);
      expect(resultados.length).toBeGreaterThan(0);
      for (const resultado of resultados) expect(resultado.coberturaFSD).toEqual(crearCoberturaNoVerificada());
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
