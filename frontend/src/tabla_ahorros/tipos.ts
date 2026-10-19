/** Una fila de la tabla: coincide con lo que devuelve el backend, todo en texto ya formateado. */
export interface FilaAhorro {
  cuentaId: string;
  capitalInicial: string;
  interesGenerado: string;
  saldoFinal: string;
  fechaApertura: string;
  /** US17: comisión mensual con 2 decimales, ej. "5.00" (sin separador de miles). */
  monthlyMaintenanceFee: string;
  /** US18: canales de atención física; lo usan los filtros, no se muestra como columna. */
  channels: { hasPhysicalBranches: boolean; hasAtms: boolean };
}

/** Criterios de ordenamiento que entiende el backend (enum CriterioOrden). */
export type CriterioOrden = "RENTABILIDAD" | "SALDO" | "FECHA";

/** Describe una columna de la tabla. */
export interface ColumnaTabla {
  /** Nombre del campo de FilaAhorro que muestra esta columna (solo campos de texto). */
  clave: Exclude<keyof FilaAhorro, "channels">;
  /** Cómo mostrar el valor; si no se indica, se muestra tal cual. */
  mostrar?: (valor: string) => string;
  titulo: string;
  ordenable: boolean;
  /** Criterio que se envía al backend al ordenar por esta columna (solo si es ordenable). */
  criterio?: CriterioOrden;
  /** Alinea el contenido a la derecha (para montos). */
  numerica?: boolean;
}

export type EstadoTabla = "CARGANDO" | "CON_DATOS" | "VACIO" | "ERROR";
