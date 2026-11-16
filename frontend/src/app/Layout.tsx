import { useCallback, useState, type ReactNode } from "react";
import { SubscriptionStatusBanner } from "../commerce/SubscriptionStatusBanner";
import { GlosarioFinanciero } from "../glosario/GlosarioFinanciero";
import { Cabecera } from "./Cabecera";
import { GlosarioContext } from "./glosario";

/** Cabecera común, aviso de la US42, pantalla actual y glosario (US24: disponible desde cualquier vista). */
export function Layout({ children }: { children: ReactNode }) {
  const [glosario, setGlosario] = useState<{ termino: string | null } | null>(null);
  const abrirGlosario = useCallback((termino?: string) => setGlosario({ termino: termino ?? null }), []);
  const cerrarGlosario = useCallback(() => setGlosario(null), []);

  return (
    <GlosarioContext.Provider value={abrirGlosario}>
      <Cabecera onAbrirGlosario={() => abrirGlosario()} />
      <SubscriptionStatusBanner />
      {children}
      <GlosarioFinanciero abierto={glosario !== null} terminoSeleccionado={glosario?.termino ?? null} onCerrar={cerrarGlosario} />
    </GlosarioContext.Provider>
  );
}
