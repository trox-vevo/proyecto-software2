import type { CoberturaFSD } from "../fsd/IndicadorFSD";
/** Una fila de la tabla: coincide con lo que devuelve el backend, todo en texto ya formateado. */
export interface FilaAhorro {
  cuentaId: string;
  /** US11: nombre de la entidad. */
  entidad: string;
  /** US11: tasa anual como fracción en texto (0.1 = 10 %). */
  tasaAnual: string;
  /** US11: monto mínimo de apertura ("1,000.00"); null si la cuenta no tiene producto. */
  montoMinimo: string | null;
  coberturaFSD?: CoberturaFSD;
  capitalInicial: string;
  interesGenerado: string;
  saldoFinal: string;
  fechaApertura: string;
  /** US17: comisión mensual con 2 decimales, ej. "5.00" (sin separador de miles). */
  monthlyMaintenanceFee: string;
  /** US18: canales de atención física; lo usan los filtros, no se muestra como columna. */
  channels: { hasPhysicalBranches: boolean; hasAtms: boolean };
  /** US19: banca digital y app móvil; se muestran como íconos en su propia columna. */
  digitalChannels?: { hasDigitalBanking: boolean; hasMobileApp: boolean };
}

/** Criterios de ordenamiento que entiende el backend (enum CriterioOrden). */
export type CriterioOrden = "RENTABILIDAD" | "SALDO" | "FECHA";

/** Describe una columna de la tabla. */
export interface ColumnaTabla {
  /** Nombre del campo de FilaAhorro que muestra esta columna (solo campos de texto). */
  clave: Exclude<keyof FilaAhorro, "channels" | "digitalChannels" | "coberturaFSD"> | "riesgo" | "coberturaFSD";
  mostrar?: (valor: string | null) => string;
  titulo: string;
  ordenable: boolean;
  /** Criterio que se envía al backend al ordenar por esta columna (solo si es ordenable). */
  criterio?: CriterioOrden;
  /** Alinea el contenido a la derecha (para montos). */
  numerica?: boolean;
}

/** SIN_BUSQUEDA (US08): todavía no se presionó "Buscar". */
export type EstadoTabla = "SIN_BUSQUEDA" | "CARGANDO" | "CON_DATOS" | "VACIO" | "ERROR";
