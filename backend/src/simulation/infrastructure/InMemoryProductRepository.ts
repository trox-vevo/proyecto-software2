import Decimal from "decimal.js";
import { DigitalChannels } from "../domain/DigitalChannels";
import { FinancialProduct } from "../domain/FinancialProduct";
import { FinancialProductRepository } from "../domain/FinancialProductRepository";
import { ServiceChannels } from "../domain/ServiceChannels";

// Datos de demostración (CLAUDE.md §7): entidades ficticias, tasas no reales. Cubren todas las
// combinaciones de canales para la Sprint Review. Las pruebas NO dependen de estos datos.
const product = (
  id: number,
  entityName: string,
  tea: string,
  minimumAmount: string,
  hasPhysicalBranches: boolean,
  hasAtms: boolean,
  hasDigitalBanking: boolean,
  hasMobileApp: boolean,
) =>
  new FinancialProduct(
    id,
    entityName,
    new Decimal(tea),
    new Decimal(minimumAmount),
    new ServiceChannels(hasPhysicalBranches, hasAtms),
    undefined,
    new DigitalChannels(hasDigitalBanking, hasMobileApp),
  );

// Map y no objeto literal: una clave como "constructor" no debe devolver nada heredado
const DEMO_PRODUCTS = new Map<string, FinancialProduct[]>([
  [
    "Lima",
    [
      product(1, "Entidad A", "0.055", "500", true, true, true, true),
      product(2, "Entidad B", "0.06", "1000", true, false, true, false),
      product(3, "Entidad C", "0.0575", "500", false, true, false, true),
      product(4, "Entidad D", "0.045", "500", false, false, false, false),
      product(5, "Entidad E", "0.05", "500", true, true, true, true),
    ],
  ],
  ["Cusco", [product(6, "Entidad F", "0.065", "500", true, false, false, true)]],
]);

export class InMemoryProductRepository implements FinancialProductRepository {
  // Por defecto, los datos de demostración; las pruebas pasan los suyos
  constructor(
    private readonly productsByDepartment: Map<string, FinancialProduct[]> = DEMO_PRODUCTS,
  ) {}

  async findFixedDepositsByDepartment(
    department: string,
  ): Promise<FinancialProduct[]> {
    return this.productsByDepartment.get(department) ?? [];
  }
}
