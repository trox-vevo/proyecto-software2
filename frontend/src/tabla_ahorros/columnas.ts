import type { ColumnaTabla } from "./tipos";

/** US17: "Sin costo" cuando la comisión es 0; "S/ x.xx" en otro caso. */
const mostrarCosto = (costo: string) =>
  Number(costo) === 0 ? "Sin costo" : `S/ ${costo}`;

/**
 * Las columnas de la tabla. Para agregar o quitar una columna basta con
 * editar esta lista (la clave debe ser un campo de FilaAhorro).
 */
export const COLUMNAS: ColumnaTabla[] = [
  { clave: "cuentaId", titulo: "Cuenta", ordenable: false },
  {
    clave: "capitalInicial",
    titulo: "Capital inicial",
    ordenable: false,
    numerica: true,
  },
  {
    clave: "interesGenerado",
    titulo: "Interés generado",
    ordenable: true,
    criterio: "RENTABILIDAD",
    numerica: true,
  },
  {
    clave: "saldoFinal",
    titulo: "Saldo final",
    ordenable: true,
    criterio: "SALDO",
    numerica: true,
  },
  {
    clave: "fechaApertura",
    titulo: "Fecha de apertura",
    ordenable: true,
    criterio: "FECHA",
  },
  { clave: "riesgo", titulo: "Riesgo", ordenable: false },
  {
    clave: "monthlyMaintenanceFee",
    titulo: "Costo de mantenimiento",
    ordenable: false,
    numerica: true,
    mostrar: mostrarCosto,
  },
];
