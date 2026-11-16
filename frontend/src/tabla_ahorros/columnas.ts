import { formatearTasa } from "../plazo_fijo/formato";
import type { ColumnaTabla } from "./tipos";

/** US17: "Sin costo" cuando la comisión es 0; "S/ x.xx" en otro caso. */
const mostrarCosto = (costo: string | null) =>
  Number(costo) === 0 ? "Sin costo" : `S/ ${costo}`;

/** US11: "S/ 1,000.00", o "—" si la cuenta no tiene producto. */
const mostrarMontoMinimo = (monto: string | null) => (monto === null ? "—" : `S/ ${monto}`);

/**
 * Las columnas de la tabla (US11). Para agregar o quitar una columna basta con
 * editar esta lista (la clave debe ser un campo de FilaAhorro).
 */
export const COLUMNAS: ColumnaTabla[] = [
  { clave: "entidad", titulo: "Entidad", ordenable: false },
  {
    clave: "tasaAnual",
    titulo: "Tasa (TEA)",
    ordenable: false,
    numerica: true,
    mostrar: (tasa) => (tasa === null ? "—" : formatearTasa(tasa)),
  },
  {
    clave: "interesGenerado",
    titulo: "Interés proyectado (1 año)",
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
    clave: "montoMinimo",
    titulo: "Monto mínimo",
    ordenable: false,
    numerica: true,
    mostrar: mostrarMontoMinimo,
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
