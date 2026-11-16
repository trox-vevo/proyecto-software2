import { formatearImporte, formatearTasa } from "../plazo_fijo/formato";
import type { ColumnaTabla } from "./tipos";

/** US17: "Sin costo" cuando la comisión es 0; "S/ x.xx" en otro caso. */
const mostrarCosto = (costo: string) =>
  Number(costo) === 0 ? "Sin costo" : `S/ ${costo}`;

/** US09: "0.05" -> "5.00 %". "—" si el backend no envió la tasa. */
const mostrarTasa = (tasa: string) => (tasa === "—" ? "—" : formatearTasa(tasa));

/** US13: "Sin mínimo" cuando es 0; "S/ 500.00" en otro caso. */
const mostrarMinimo = (minimo: string) =>
  minimo === "—" ? "—" : Number(minimo) === 0 ? "Sin mínimo" : formatearImporte(minimo);

/**
 * Las columnas de la tabla. Para agregar o quitar una columna basta con
 * editar esta lista (la clave debe ser un campo de FilaAhorro).
 */
export const COLUMNAS: ColumnaTabla[] = [
  { clave: "cuentaId", titulo: "Cuenta", ordenable: false },
  { clave: "entityName", titulo: "Entidad financiera", ordenable: false },
  { clave: "tasaAnual", titulo: "Tasa anual (TEA)", ordenable: false, numerica: true, mostrar: mostrarTasa },
  { clave: "montoMinimo", titulo: "Monto mínimo", ordenable: false, numerica: true, mostrar: mostrarMinimo },
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
  { clave: "coberturaFSD", titulo: "Cobertura FSD", ordenable: false },
  {
    clave: "monthlyMaintenanceFee",
    titulo: "Costo de mantenimiento",
    ordenable: false,
    numerica: true,
    mostrar: mostrarCosto,
  },
];
