import Decimal from "decimal.js";
import type { DatabaseSync } from "node:sqlite";
import { DigitalChannels } from "../domain/DigitalChannels";
import { FinancialProduct } from "../domain/FinancialProduct";
import type { FinancialProductRepository } from "../domain/FinancialProductRepository";
import { ServiceChannels } from "../domain/ServiceChannels";

interface ProductRow {
  id: number;
  name: string;
  tea: string;
  minimum_amount: string;
  has_physical_branches: number;
  has_atms: number;
  has_digital_banking: number;
  has_mobile_app: number;
  fsd_coverage: string | null;
}

// US10: los depósitos a plazo fijo salen de la base única (antes: InMemoryProductRepository)
export class SqliteProductRepository implements FinancialProductRepository {
  constructor(private readonly database: DatabaseSync) {}

  async findFixedDepositsByDepartment(department: string): Promise<FinancialProduct[]> {
    const rows = this.database.prepare(`
      SELECT p.id, e.name, p.tea, p.minimum_amount, e.has_physical_branches, e.has_atms,
             e.has_digital_banking, e.has_mobile_app, e.fsd_coverage
      FROM fixed_deposit_products p JOIN financial_entities e ON e.id = p.entity_id
      WHERE p.department = ?
      ORDER BY p.id`).all(department) as unknown as ProductRow[];

    return rows.map((row) => new FinancialProduct(
      row.id,
      row.name,
      new Decimal(row.tea),
      new Decimal(row.minimum_amount),
      new ServiceChannels(row.has_physical_branches === 1, row.has_atms === 1),
      row.fsd_coverage === null ? undefined : JSON.parse(row.fsd_coverage),
      new DigitalChannels(row.has_digital_banking === 1, row.has_mobile_app === 1),
    ));
  }
}
