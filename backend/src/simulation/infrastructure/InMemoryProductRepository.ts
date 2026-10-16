import Decimal from "decimal.js";
import { FinancialProduct } from "../domain/FinancialProduct";
import { FinancialProductRepository } from "../domain/FinancialProductRepository";

// Datos de ejemplo hasta que se defina la base de datos: las tasas NO son reales.
const cajaArequipa = new FinancialProduct(
  1,
  "Caja Arequipa",
  new Decimal("0.055"),
  new Decimal("500"),
);
const cajaHuancayo = new FinancialProduct(
  2,
  "Caja Huancayo",
  new Decimal("0.0575"),
  new Decimal("1000"),
);
const interbank = new FinancialProduct(
  3,
  "Interbank",
  new Decimal("0.042"),
  new Decimal("500"),
);
const cajaCusco = new FinancialProduct(
  4,
  "Caja Cusco",
  new Decimal("0.06"),
  new Decimal("500"),
);

export class InMemoryProductRepository implements FinancialProductRepository {
  // Map y no objeto literal: una clave como "constructor" no debe devolver nada heredado
  private readonly productsByDepartment = new Map<string, FinancialProduct[]>([
    ["Lima", [cajaArequipa, cajaHuancayo, interbank]],
    ["Arequipa", [cajaArequipa]],
    ["Cusco", [cajaCusco, cajaArequipa]],
  ]);

  async findFixedDepositsByDepartment(
    department: string,
  ): Promise<FinancialProduct[]> {
    return this.productsByDepartment.get(department) ?? [];
  }
}
