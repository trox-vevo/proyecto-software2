import {
  crearCoberturaNoVerificada,
  type CoberturaFSD
} from "./CoberturaFSD";

export function agregarCoberturaFSD<T extends { cuentaId: string }>(
  filas: T[]
): Array<T & { coberturaFSD: CoberturaFSD }> {
  return filas.map((fila) => ({
    ...fila,
    coberturaFSD: crearCoberturaNoVerificada()
  }));
}
