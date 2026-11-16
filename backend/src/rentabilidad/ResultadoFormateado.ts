import type { CoberturaFSD } from "../fsd/CoberturaFSD";
/** Un resultado listo para enviar al frontend: montos y fecha ya formateados como texto. */
export interface ResultadoFormateado {
  cuentaId: string;
  /** US11: nombre de la entidad; si la cuenta no tiene producto, el titular. */
  entidad: string;
  /** US11: tasa anual como fracción en texto (0.1 = 10 %), igual que `tea` en plazo fijo. */
  tasaAnual: string;
  /** US11: monto mínimo con formato de monto ("1,000.00"); null si la cuenta no tiene producto. */
  montoMinimo: string | null;
  coberturaFSD: CoberturaFSD;
  capitalInicial: string;
  interesGenerado: string;
  saldoFinal: string;
  fechaApertura: string;
  /** US17: comisión mensual con 2 decimales y sin separador de miles, ej. "5.00". */
  monthlyMaintenanceFee: string;
  /** US18: misma forma que en POST /api/simulations/fixed-deposits. */
  channels: { hasPhysicalBranches: boolean; hasAtms: boolean };
  /** US19: misma forma que en POST /api/simulations/fixed-deposits. */
  digitalChannels: { hasDigitalBanking: boolean; hasMobileApp: boolean };
}
