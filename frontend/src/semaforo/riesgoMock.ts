import type { FilaAhorro } from "../tabla_ahorros/tipos";
import type { FilaConRiesgo, Riesgo } from "./tipos";

/**
 * TEMPORAL: datos inventados para poder construir US23 antes de que el backend envíe el riesgo
 * (TS-67/TS-68). No representan reglas reales. Cuando el backend lo envíe, se borra este archivo
 * y la llamada a aplicarRiesgoMock() en el controlador.
 * AH-006 es null a propósito, para probar el caso "sin clasificar".
 */
const RIESGO_MOCK: Record<string, Riesgo | null> = {
  "AH-001": { nivel: "VERDE" },
  "AH-002": { nivel: "VERDE" },
  "AH-003": { nivel: "ROJO" },
  "AH-004": { nivel: "AMARILLO" },
  "AH-005": { nivel: "ROJO" },
  "AH-006": null,
};

/**
 * Agrega `riesgo` a cada fila. Si la fila ya trae riesgo del backend (incluso null), se respeta;
 * solo se usa el mock cuando el campo no existe.
 */
export function aplicarRiesgoMock(filas: FilaAhorro[]): FilaConRiesgo[] {
  return filas.map((fila) => {
    const delBackend = (fila as Partial<FilaConRiesgo>).riesgo;
    return {
      ...fila,
      riesgo: delBackend !== undefined ? delBackend : (RIESGO_MOCK[fila.cuentaId] ?? null),
    };
  });
}
