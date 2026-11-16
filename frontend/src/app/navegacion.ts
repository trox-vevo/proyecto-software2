import { useEffect, useState } from "react";

const EVENTO_NAVEGACION = "yupay:navegar";

/** Cambia de pantalla sin recargar. Todas las partes de la app que usan useRuta() se enteran. */
export function navegar(ruta: string, { reemplazar = false }: { reemplazar?: boolean } = {}): void {
  if (reemplazar) window.history.replaceState(null, "", ruta);
  else window.history.pushState(null, "", ruta);
  window.dispatchEvent(new Event(EVENTO_NAVEGACION));
}

/** Ruta actual (pathname). Se actualiza con navegar() y con los botones atrás/adelante del navegador. */
export function useRuta(): string {
  const [ruta, setRuta] = useState(() => window.location.pathname);
  useEffect(() => {
    const actualizar = () => setRuta(window.location.pathname);
    window.addEventListener("popstate", actualizar);
    window.addEventListener(EVENTO_NAVEGACION, actualizar);
    return () => {
      window.removeEventListener("popstate", actualizar);
      window.removeEventListener(EVENTO_NAVEGACION, actualizar);
    };
  }, []);
  return ruta;
}

/** Para <a href> internos: evita la recarga y navega. */
export function alHacerClic(ruta: string) {
  return (evento: { preventDefault(): void }) => {
    evento.preventDefault();
    navegar(ruta);
  };
}
