import type Decimal from "decimal.js";
import type { RiskLevel } from "./RiskLevel";

export interface IndicatorRequirement {
  readonly name: string;
  readonly unit: string;
  /** Rango válido de datos, con límites inclusivos aprobados para ese indicador. */
  readonly minimum: Decimal;
  readonly maximum: Decimal;
  /** Antigüedad máxima aprobada para las observaciones. No tiene valor por defecto. */
  readonly maxAgeDays: number;
}

export interface RiskCondition {
  readonly indicator: string;
  readonly operator: "LT" | "LTE" | "GT" | "GTE";
  readonly threshold: Decimal;
}

export interface RiskPolicyApproval {
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly reference: string;
}

/**
 * Propuesta técnica de TS-66, sin umbrales ni evaluador productivo.
 * Cada nivel exige todas sus condiciones (AND); exactamente un nivel debe coincidir.
 * approval=null identifica una propuesta que NO debe producir clasificaciones.
 * TS-67 validará datos/configuración y devolverá null si no puede clasificar.
 */
export interface RiskClassificationRules {
  readonly version: string;
  readonly approval: RiskPolicyApproval | null;
  readonly requiredIndicators: readonly IndicatorRequirement[];
  readonly levels: Readonly<Record<RiskLevel, readonly RiskCondition[]>>;
}
