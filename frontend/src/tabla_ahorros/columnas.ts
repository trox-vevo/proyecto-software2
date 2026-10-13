import type { ColumnaTabla } from "./tipos";

/**
 * Las columnas de la tabla. Para agregar o quitar una columna basta con
 * editar esta lista (la clave debe ser un campo de FilaAhorro).
 */
export const COLUMNAS: ColumnaTabla[] = [
  { clave: "cuentaId", titulo: "Cuenta", ordenable: false },
  { clave: "capitalInicial", titulo: "Capital inicial", ordenable: false, numerica: true },
  { clave: "interesGenerado", titulo: "Interés generado", ordenable: true, criterio: "RENTABILIDAD", numerica: true },
  { clave: "saldoFinal", titulo: "Saldo final", ordenable: true, criterio: "SALDO", numerica: true },
  { clave: "fechaApertura", titulo: "Fecha de apertura", ordenable: true, criterio: "FECHA" },
];
