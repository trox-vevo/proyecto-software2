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

  it("US19: cada resultado trae digitalChannels con booleanos", async () => {
    const { resultados } = await (await fetch(endpoint)).json();

    expect(resultados.length).toBeGreaterThan(0);
    for (const resultado of resultados) {
      expect(resultado.digitalChannels).toEqual({
        hasDigitalBanking: expect.any(Boolean),
        hasMobileApp: expect.any(Boolean),
      });
    }
  });

  it("permite re-simular únicamente la cuenta seleccionada", async () => {
    const all = await (await fetch(endpoint)).json();
    const accountId = all.resultados[0].cuentaId;
    const response = await fetch(`${endpoint}?dias=180&accountId=${encodeURIComponent(accountId)}`);
    const { resultados } = await response.json();

    expect(response.status).toBe(200);
    expect(resultados).toHaveLength(1);
    expect(resultados[0].cuentaId).toBe(accountId);
  });
});

describe("US09: búsqueda por monto y departamento", () => {
  const numero = (texto: string) => Number(texto.replace(/,/g, ""));

  it("monto=1000&departamento=Lima -> 5 productos ordenados por interés, con entidad, tasa y monto mínimo", async () => {
    const response = await fetch(`${endpoint}?monto=1000&departamento=Lima&dias=365`);
    const { resultados } = await response.json();

    expect(response.status).toBe(200);
    expect(resultados).toHaveLength(5);
    const intereses = resultados.map((r: { interesGenerado: string }) => numero(r.interesGenerado));
    expect(intereses).toEqual([...intereses].sort((a, b) => b - a));
    for (const resultado of resultados) {
      expect(resultado.entidad).toEqual(expect.any(String));
      expect(resultado.tasaAnual).toEqual(expect.any(String));
      expect(resultado).toHaveProperty("montoMinimo");
      expect(resultado.capitalInicial).toBe("1,000.00");
    }
  });

  it("monto=800 excluye el producto con monto mínimo mayor (AH-003)", async () => {
    const { resultados } = await (await fetch(`${endpoint}?monto=800&departamento=Lima`)).json();
    expect(resultados.map((r: { cuentaId: string }) => r.cuentaId)).not.toContain("AH-003");
  });

  it("departamento sin productos -> 200 y []", async () => {
    const response = await fetch(`${endpoint}?monto=1000&departamento=Arequipa`);
    expect(response.status).toBe(200);
    expect((await response.json()).resultados).toEqual([]);
  });

  it.each([
    ["solo monto", "monto=1000"],
    ["solo departamento", "departamento=Lima"],
    ["monto 0", "monto=0&departamento=Lima"],
    ["monto no numérico", "monto=abc&departamento=Lima"],
    ["departamento en blanco", "monto=1000&departamento=%20%20"],
    ["departamento de más de 50 caracteres", `monto=1000&departamento=${"x".repeat(51)}`],
    ["criterio inválido", "criterio=OTRO"],
    ["algoritmo inválido", "algoritmo=otro"],
    ["fecha inválida", "desde=no-es-fecha"],
  ])("%s -> 400 con un mensaje claro", async (_caso, query) => {
    const response = await fetch(`${endpoint}?${query}`);
    const cuerpo = await response.json();
    expect(response.status).toBe(400);
    expect(cuerpo).toEqual({ error: expect.any(String) });
    expect(cuerpo.error).not.toMatch(/Error interno|stack|undefined|TypeError/i);
  });

  it("solo uno de los dos -> mensaje pidiendo ambos", async () => {
    const cuerpo = await (await fetch(`${endpoint}?monto=1000`)).json();
    expect(cuerpo.error).toBe("Para buscar, envía monto y departamento.");
  });
});
