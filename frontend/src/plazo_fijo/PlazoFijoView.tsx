import { FormularioPlazoFijo } from "./FormularioPlazoFijo";
import { TablaResultadosPlazoFijo } from "./TablaResultadosPlazoFijo";
import { usePlazoFijoController } from "./usePlazoFijoController";

export function PlazoFijoView() {
  const flujo = usePlazoFijoController();
  return (
    <section className="plazo-seccion" aria-labelledby="titulo-plazo-fijo">
      <h2 id="titulo-plazo-fijo">Depósito a Plazo Fijo</h2>
      <p>Configura tu inversión y compara los resultados de la simulación.</p>
      <p>Demostración: las entidades y tasas del catálogo actual son datos de ejemplo, no ofertas vigentes.</p>
      <FormularioPlazoFijo parametros={flujo.parametros} onCambiar={flujo.cambiarParametros}
        onSimular={flujo.simular} cargando={flujo.cargando} />
      {flujo.cargando && <p role="status">Calculando resultados…</p>}
      {flujo.error && <p role="alert">{flujo.error}</p>}
      {flujo.simulacion && (
        <TablaResultadosPlazoFijo resultados={flujo.simulacion.resultados}
          modalidad={flujo.simulacion.parametros.paymentMode} />
      )}
    </section>
  );
}
