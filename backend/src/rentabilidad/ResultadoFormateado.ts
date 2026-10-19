/** Un resultado listo para enviar al frontend: montos y fecha ya formateados como texto. */
export interface ResultadoFormateado {
  cuentaId: string;
  capitalInicial: string;
  interesGenerado: string;
  saldoFinal: string;
  fechaApertura: string;
  /** US17: comisión mensual con 2 decimales y sin separador de miles, ej. "5.00". */
  monthlyMaintenanceFee: string;
  /** US18: misma forma que en POST /api/simulations/fixed-deposits. */
  channels: { hasPhysicalBranches: boolean; hasAtms: boolean };
}
