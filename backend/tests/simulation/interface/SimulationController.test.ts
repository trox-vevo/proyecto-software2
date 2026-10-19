import { once } from "node:events";
import { Server } from "node:http";
import { AddressInfo } from "node:net";
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../../src/app";
import { FinancialProduct } from "../../../src/simulation/domain/FinancialProduct";
import { ServiceChannels } from "../../../src/simulation/domain/ServiceChannels";

// Prueba de integración: app real en un puerto libre, con datos propios (no los de demostración).
const products = [
  new FinancialProduct(1, "Entidad 1", new Decimal("0.055"), new Decimal("500"), new ServiceChannels(true, true)),
  new FinancialProduct(2, "Entidad 2", new Decimal("0.0575"), new Decimal("1000"), new ServiceChannels(true, false)),
  new FinancialProduct(3, "Entidad 3", new Decimal("0.042"), new Decimal("500"), new ServiceChannels(false, true)),
];
const app = createApp({
  findFixedDepositsByDepartment: async (department) => (department === "Lima" ? products : []),
});

let server: Server;
let endpoint: string;

beforeAll(async () => {
  server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  endpoint = `http://localhost:${port}/api/simulations/fixed-deposits`;
});

afterAll(() => {
  server.close();
});

const post = (body: unknown) =>
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const validRequest = {
  amount: "1000.00",
  termDays: 360,
  department: "Lima",
  paymentMode: "AT_MATURITY",
};

describe("POST /api/simulations/fixed-deposits", () => {
  it("200: devuelve los productos ordenados, con decimales como string y canales (US18)", async () => {
    const response = await post(validRequest);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        productId: 2,
        entityName: "Entidad 2",
        tea: "0.0575",
        totalInterest: "57.50",
        monthlyInterest: null,
        channels: { hasPhysicalBranches: true, hasAtms: false },
      },
      {
        productId: 1,
        entityName: "Entidad 1",
        tea: "0.055",
        totalInterest: "55.00",
        monthlyInterest: null,
        channels: { hasPhysicalBranches: true, hasAtms: true },
      },
      {
        productId: 3,
        entityName: "Entidad 3",
        tea: "0.042",
        totalInterest: "42.00",
        monthlyInterest: null,
        channels: { hasPhysicalBranches: false, hasAtms: true },
      },
    ]);
  });

  it("200: no incluye monthlyMaintenanceFee (US17 no aplica a plazo fijo)", async () => {
    const results: Record<string, unknown>[] = await (await post(validRequest)).json();

    for (const result of results) {
      expect(result).not.toHaveProperty("monthlyMaintenanceFee");
    }
  });

  it("200: en MONTHLY devuelve monthlyInterest con 2 decimales", async () => {
    const response = await post({ ...validRequest, paymentMode: "MONTHLY" });
    const results: { monthlyInterest: string }[] = await response.json();

    expect(response.status).toBe(200);
    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.monthlyInterest).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it("200: excluye productos con monto mínimo mayor al ingresado", async () => {
    const response = await post({ ...validRequest, amount: "700" });
    const results: { productId: number }[] = await response.json();

    expect(results.map((r) => r.productId)).toEqual([1, 3]);
  });

  it("200: devuelve [] si no hay productos en el departamento", async () => {
    const response = await post({ ...validRequest, department: "Tacna" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it.each([
    ["plazo no permitido", { termDays: 200 }, "El plazo debe ser"],
    ["monto menor a S/ 500", { amount: "499.99" }, "El monto mínimo"],
  ])("400: %s, con el mensaje del servicio", async (_, change, message) => {
    const response = await post({ ...validRequest, ...change });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain(message);
  });

  it.each([
    ["amount como número", { amount: 1000 }],
    ["amount no numérico", { amount: "mil" }],
    ["amount negativo", { amount: "-1000" }],
    ["amount con más de 2 decimales", { amount: "1000.001" }],
    ["termDays como texto", { termDays: "360" }],
    ["department ausente", { department: undefined }],
    ["paymentMode desconocido", { paymentMode: "WEEKLY" }],
  ])("400: %s", async (_, change) => {
    const response = await post({ ...validRequest, ...change });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toEqual(expect.any(String));
  });

  it("400: JSON mal formado, sin exponer detalles técnicos", async () => {
    const response = await post("{ amount: ");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(Object.keys(body)).toEqual(["message"]);
  });
});
