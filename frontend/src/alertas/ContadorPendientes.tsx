import "./alertas.css";

/** Cuántas alertas faltan por leer. Se anuncia a los lectores de pantalla cuando cambia. */
export function ContadorPendientes({ pendientes }: { pendientes: number }) {
  const texto =
    pendientes === 0
      ? "Sin alertas pendientes"
      : `${pendientes} ${pendientes === 1 ? "alerta pendiente" : "alertas pendientes"}`;

  return (
    <span className="alertas-contador" aria-live="polite">
      {texto}
    </span>
  );
}
