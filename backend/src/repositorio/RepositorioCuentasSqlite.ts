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
  fsd_coverage: string | null;
}

/** US09/US11: mismas cuentas y mismo contrato que RepositorioCuentas, pero leídas de la base única. */
export class RepositorioCuentasSqlite {
  constructor(private readonly database: DatabaseSync) {}

  obtenerTodas(): CuentaAhorros[] {
    const rows = this.database
      .prepare("SELECT * FROM savings_accounts ORDER BY id")
      .all() as unknown as CuentaRow[];
    return rows.map((c) => new CuentaAhorros(
      c.id,
      c.holder,
      c.balance,
      c.annual_rate,
      new Date(c.opened_at),
      c.monthly_maintenance_fee,
      new ServiceChannels(c.has_physical_branches === 1, c.has_atms === 1),
      c.fsd_coverage === null ? undefined : JSON.parse(c.fsd_coverage),
      new DigitalChannels(c.has_digital_banking === 1, c.has_mobile_app === 1),
    ));
  }
}
