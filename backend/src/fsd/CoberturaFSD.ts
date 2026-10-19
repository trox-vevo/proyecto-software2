export type EstadoCoberturaFSD =
  | "CUBIERTO"
  | "NO_CUBIERTO"
  | "NO_VERIFICADO";

export interface CoberturaFSD {
  entidadFinanciera: string | null;
  estado: EstadoCoberturaFSD;
  fechaVerificacion: string | null;
}

export function crearCoberturaNoVerificada(
  entidadFinanciera: string | null = null
): CoberturaFSD {
  return {
    entidadFinanciera,
    estado: "NO_VERIFICADO",
    fechaVerificacion: null
};
}
