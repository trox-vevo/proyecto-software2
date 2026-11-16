import { Decimal } from "decimal.js";
import type { DatabaseSync } from "node:sqlite";
import { CuentaAhorros } from "../rentabilidad/CuentaAhorros";
import { DigitalChannels } from "../simulation/domain/DigitalChannels";
import { ServiceChannels } from "../simulation/domain/ServiceChannels";

interface CuentaRow {
  id: string;
  holder: string;
  balance: string;
  annual_rate: string;
  opened_at: string;
  monthly_maintenance_fee: string;
  has_physical_branches: number;
  has_atms: number;
  has_digital_banking: number;
  has_mobile_app: number;
  /** Cobertura de la cuenta o, si no tiene, la de su entidad. */
  fsd: string | null;
  entity_name: string | null;
  department: string | null;
  minimum_amount: string | null;
}

/** US09/US11: mismas cuentas y mismo contrato que RepositorioCuentas, pero leídas de la base única. */
export class RepositorioCuentasSqlite {
  constructor(private readonly database: DatabaseSync) {}

  obtenerTodas(): CuentaAhorros[] {
    const rows = this.database
      .prepare(`SELECT s.*, e.name AS entity_name, COALESCE(s.fsd_coverage, e.fsd_coverage) AS fsd
        FROM savings_accounts s LEFT JOIN financial_entities e ON e.id = s.entity_id
        ORDER BY s.id`)
      .all() as unknown as CuentaRow[];
    return rows.map((c) => new CuentaAhorros(
      c.id,
      c.holder,
      c.balance,
      c.annual_rate,
      new Date(c.opened_at),
      c.monthly_maintenance_fee,
      new ServiceChannels(c.has_physical_branches === 1, c.has_atms === 1),
      c.fsd === null ? undefined : JSON.parse(c.fsd),
      new DigitalChannels(c.has_digital_banking === 1, c.has_mobile_app === 1),
      c.entity_name === null || c.department === null || c.minimum_amount === null
        ? null
        : { entidad: c.entity_name, departamento: c.department, montoMinimo: new Decimal(c.minimum_amount) },
    ));
  }
}
