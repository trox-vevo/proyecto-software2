import type { DatabaseSync } from "node:sqlite";
import { CuentaAhorros } from "../rentabilidad/CuentaAhorros";
import { DigitalChannels } from "../simulation/domain/DigitalChannels";
import { ServiceChannels } from "../simulation/domain/ServiceChannels";
import { crearCoberturaNoVerificada, validarCoberturaFSD } from "../fsd/CoberturaFSD";
import { numericIdentifier } from "../registration/domain/NumericIdentifier";

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
  entity_id: number | null;
  entity_name: string | null;
}

/** US09/US11: mismas cuentas y mismo contrato que RepositorioCuentas, pero leídas de la base única. */
export class RepositorioCuentasSqlite {
  constructor(private readonly database: DatabaseSync) {}

  obtenerTodas(): CuentaAhorros[] {
    const rows = this.database
      .prepare(`SELECT s.id, s.holder, s.balance, s.annual_rate, s.opened_at, s.monthly_maintenance_fee,
        s.has_physical_branches, s.has_atms, s.has_digital_banking, s.has_mobile_app,
        e.id AS entity_id, e.name AS entity_name, e.fsd_coverage
        FROM savings_accounts s
        LEFT JOIN savings_account_entities a ON a.account_id = s.id
        LEFT JOIN financial_entities e ON e.id = a.entity_id ORDER BY s.id`)
      .all() as unknown as CuentaRow[];
    return rows.map((c) => {
      // La evidencia siempre procede de la entidad asociada. JSON inválido o una
      // identidad discordante se degrada a no verificada, sin perder la cuenta.
      let raw: unknown;
      try { raw = c.fsd_coverage === null ? undefined : JSON.parse(c.fsd_coverage); }
      catch { raw = undefined; }
      const evidence = validarCoberturaFSD(raw);
      const coverage = c.entity_name !== null && evidence.entidadFinanciera === c.entity_name
        ? evidence : crearCoberturaNoVerificada(c.entity_name);
      return new CuentaAhorros(
        c.id,
        c.holder,
        c.balance,
        c.annual_rate,
        new Date(c.opened_at),
        c.monthly_maintenance_fee,
        new ServiceChannels(c.has_physical_branches === 1, c.has_atms === 1),
        coverage,
        new DigitalChannels(c.has_digital_banking === 1, c.has_mobile_app === 1),
        c.entity_id === null ? null : numericIdentifier(c.entity_id),
        c.entity_name,
      );
    });
  }
}
