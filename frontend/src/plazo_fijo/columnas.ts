import { formatearImporte, formatearTasa } from "./formato";
import type { ModalidadPago, ResultadoPlazoFijo } from "./tipos";

interface ColumnaPlazoFijo {
  clave: keyof ResultadoPlazoFijo;
  titulo: string;
  numerica?: boolean;
  presentar: (resultado: ResultadoPlazoFijo) => string;
}

const COLUMNAS: readonly ColumnaPlazoFijo[] = [
  { clave: "entityName", titulo: "Entidad", presentar: (fila) => fila.entityName },
  { clave: "tea", titulo: "Tasa (TEA)", numerica: true, presentar: (fila) => formatearTasa(fila.tea) },
  { clave: "totalInterest", titulo: "Intereses Totales", numerica: true,
    presentar: (fila) => formatearImporte(fila.totalInterest) },
  { clave: "minimumAmount", titulo: "Monto Mínimo de Cuenta", numerica: true,
    presentar: (fila) => formatearImporte(fila.minimumAmount) },
];

const COLUMNA_MENSUAL: ColumnaPlazoFijo = {
  clave: "monthlyInterest", titulo: "Intereses Mensuales (Aproximado)", numerica: true,
  presentar: (fila) => fila.monthlyInterest === null ? "—" : formatearImporte(fila.monthlyInterest),
};

export function obtenerColumnas(modalidad: ModalidadPago): readonly ColumnaPlazoFijo[] {
  return modalidad === "MONTHLY" ? [...COLUMNAS, COLUMNA_MENSUAL] : COLUMNAS;
}
