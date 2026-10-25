import type { ReactNode } from "react";

// Dibujos que puede mostrar la pantalla vacía. Por ahora solo hay una lupa.
const ICONOS: Record<string, ReactNode> = {
  // Lupa con un signo de interrogación dentro
  busqueda: (
    <svg viewBox="0 0 120 120" width="120" height="120" fill="none" strokeLinecap="round">
      <circle cx="52" cy="52" r="32" stroke="currentColor" strokeWidth="6" />
      <line x1="76" y1="76" x2="102" y2="102" stroke="currentColor" strokeWidth="10" />
      <path
        d="M42 44a10 10 0 1 1 14 9c-3 1.5-4 3.5-4 6.5"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="52" cy="70" r="3" fill="currentColor" />
    </svg>
  ),
};

interface Props {
  titulo: string;
  mensaje: string;
  /** Nombre del dibujo a mostrar, por ejemplo "busqueda". */
  icono: string;
}

/** US13: pantalla que aparece cuando la búsqueda no encontró resultados. */
export function EmptyStateComponent({ titulo, mensaje, icono }: Props) {
  function mostrarZeroState() {
    return (
      <div className="tabla-mensaje zero-state" role="status">
        <div className="zero-state-icono" aria-hidden="true">
          {ICONOS[icono] ?? ICONOS.busqueda}
        </div>
        <h2 className="zero-state-titulo">{titulo}</h2>
        <p className="zero-state-mensaje">{mensaje}</p>
      </div>
    );
  }

  return mostrarZeroState();
}
