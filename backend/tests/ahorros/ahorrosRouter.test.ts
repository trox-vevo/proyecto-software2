import { once } from "node:events";
import { Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

// Prueba de contrato (US17/US18): solo verifica la forma de cada resultado, no sus valores,
// para que cambiar los datos de demostración (data/cuentas.json) no la rompa.
let server: Server;
let endpoint: string;

beforeAll(async () => {
  server = createApp({ findFixedDepositsByDepartment: async () => [] }).listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  endpoint = `http://localhost:${port}/api/ahorros/rentabilidad`;
});

afterAll(() => {
  server.close();
});

describe("GET /api/ahorros/rentabilidad", () => {
  it("cada resultado trae monthlyMaintenanceFee (string con 2 decimales) y channels con booleanos", async () => {
    const response = await fetch(endpoint);
    const { resultados } = await response.json();

    expect(response.status).toBe(200);
    expect(resultados.length).toBeGreaterThan(0);
    for (const resultado of resultados) {
      expect(resultado.monthlyMaintenanceFee).toMatch(/^\d+\.\d{2}$/);
      expect(resultado.channels).toEqual({
        hasPhysicalBranches: expect.any(Boolean),
        hasAtms: expect.any(Boolean),
      });
    }
  });
});
