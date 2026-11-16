import { createContext, useContext } from "react";

/** Abre el glosario del Layout desde cualquier pantalla, sin pasar props por cada nivel (US24). */
export const GlosarioContext = createContext<(termino?: string) => void>(() => {});

export const useAbrirGlosario = () => useContext(GlosarioContext);
