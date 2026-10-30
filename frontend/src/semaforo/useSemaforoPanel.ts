import { useState } from "react";

/** Recuerda qué fila tiene abierto su panel de riesgo (solo una a la vez). */
export function useSemaforoPanel() {
  const [filaAbiertaId, setFilaAbiertaId] = useState<string | null>(null);

  function alternar(cuentaId: string) {
    setFilaAbiertaId((actual) => (actual === cuentaId ? null : cuentaId));
  }

  return { filaAbiertaId, alternar };
}
