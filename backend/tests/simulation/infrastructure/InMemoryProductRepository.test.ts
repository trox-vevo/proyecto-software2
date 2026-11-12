import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { FinancialProduct } from "../../../src/simulation/domain/FinancialProduct";
import { ServiceChannels } from "../../../src/simulation/domain/ServiceChannels";
import { InMemoryProductRepository } from "../../../src/simulation/infrastructure/InMemoryProductRepository";

// Usa sus propios datos: cambiar los de demostración no debe romper esta prueba.
describe("InMemoryProductRepository", () => {
  const product = new FinancialProduct(1, "Entidad X", new Decimal("0.05"), new Decimal("500"), new ServiceChannels(true, false));
  const repository = new InMemoryProductRepository(new Map([["Piura", [product]]]));

  it("devuelve los productos del departamento", async () => {
    expect(await repository.findFixedDepositsByDepartment("Piura")).toEqual([product]);
  });

  it.each(["Tacna", "constructor"])("devuelve [] para un departamento sin productos (%s)", async (department) => {
    expect(await repository.findFixedDepositsByDepartment(department)).toEqual([]);
  });
});
