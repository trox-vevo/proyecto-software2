import { DownloadReportButton } from "./DownloadReportButton";
import { FormularioPlazoFijo } from "./FormularioPlazoFijo";
import { TablaResultadosPlazoFijo } from "./TablaResultadosPlazoFijo";
import { usePlazoFijoController } from "./usePlazoFijoController";
import { useEffect } from "react";
import type { ParametrosPlazoFijo } from "./tipos";

export function PlazoFijoView({
  onViewPlans,
  replay,
}: {
  onViewPlans?: () => void;
  replay?: { id: number; parameters: ParametrosPlazoFijo };
}) {
  const flujo = usePlazoFijoController();
  const { volverASimular } = flujo;
  useEffect(() => {
    if (replay) void volverASimular(replay.parameters);
  }, [replay, volverASimular]);
  return (
    <section className="plazo-seccion" aria-labelledby="titulo-plazo-fijo">
      <h2 id="titulo-plazo-fijo">Depósito a Plazo Fijo</h2>
      <p>Configura tu inversión y compara los resultados de la simulación.</p>
      <FormularioPlazoFijo parametros={flujo.parametros} onCambiar={flujo.cambiarParametros}
        onSimular={flujo.simular} cargando={flujo.cargando} errores={flujo.errores} />
      {flujo.cargando && <p role="status">Calculando resultados…</p>}
      {flujo.error && <p role="alert">{flujo.error}</p>}
      {flujo.simulacion && (
        <TablaResultadosPlazoFijo resultados={flujo.simulacion.resultados}
          modalidad={flujo.simulacion.parametros.paymentMode} onViewPlans={onViewPlans}
          parametros={flujo.simulacion.parametros} />
      )}
      {/* US30: exportar los resultados a PDF (el botón se oculta solo si el usuario no es Pro) */}
      {flujo.simulacion && flujo.simulacion.resultados.length > 0 && (
        <DownloadReportButton parametros={flujo.simulacion.parametros} />
      )}
    </section>
  );
}
