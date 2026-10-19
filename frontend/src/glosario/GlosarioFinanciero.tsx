
import { useEffect, useRef, useState } from "react";
import "./GlosarioFinanciero.css";

interface TerminoFinanciero {
  termino: string;
  definicion: string;
}

interface Props {
  abierto: boolean;
  terminoSeleccionado: string | null;
  onCerrar: () => void;
}

const TERMINOS: TerminoFinanciero[] = [
  {
    termino: "Capital inicial",
    definicion: "Cantidad de dinero que depositas o inviertes al comenzar."
  },
  {
    termino: "FSD",
    definicion: "Fondo de Seguro de Depósitos. Protege los depósitos elegibles de los ahorristas en las entidades financieras miembros, dentro de los límites y condiciones vigentes."
  },
  {
    termino: "Interés",
    definicion: "Dinero que puedes ganar por mantener tus ahorros depositados durante un periodo."
  },
  {
    termino: "Rentabilidad",
    definicion: "Ganancia que genera tu dinero en relación con la cantidad que depositaste o invertiste."
  },
  {
    termino: "Saldo final",
    definicion: "Cantidad de dinero que tendrás al finalizar un periodo, incluyendo el capital inicial y los intereses generados."
  },
  {
    termino: "TEA",
    definicion: "Tasa Efectiva Anual. Expresa el rendimiento o costo del dinero durante un año considerando la capitalización de intereses."
  },
  {
    termino: "TREA",
    definicion: "Tasa de Rendimiento Efectiva Anual. Permite comparar cuánto puedes ganar realmente con un depósito durante un año, considerando los cargos aplicables."
  }
].sort((a, b) => a.termino.localeCompare(b.termino, "es"));

export function GlosarioFinanciero({
  abierto,
  terminoSeleccionado,
  onCerrar
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const elementoAnterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!abierto) return;

    elementoAnterior.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    botonCerrar.current?.focus();

    function manejarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        onCerrar();
      }
    }

    document.addEventListener("keydown", manejarTecla);

    return () => {
      document.removeEventListener("keydown", manejarTecla);
      elementoAnterior.current?.focus();
    };
  }, [abierto, onCerrar]);

  useEffect(() => {
    if (abierto) {
      setBusqueda("");
    }
  }, [abierto, terminoSeleccionado]);

  if (!abierto) return null;

  const terminoActivo = terminoSeleccionado
    ? TERMINOS.find(
        (item) =>
          item.termino.toLowerCase() === terminoSeleccionado.toLowerCase()
      )
    : undefined;

  const terminosFiltrados = TERMINOS.filter((item) =>
    item.termino.toLowerCase().includes(busqueda.toLowerCase()) ||
    item.definicion.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="glosario-fondo">
      <section
        className="glosario-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="glosario-titulo"
      >
        <header className="glosario-encabezado">
          <h2 id="glosario-titulo">Glosario financiero</h2>
          <button
            ref={botonCerrar}
            type="button"
            className="glosario-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar glosario"
          >
            ×
          </button>
        </header>

        <p className="glosario-introduccion">
          Consulta el significado de los principales términos financieros.
        </p>

        <label htmlFor="glosario-busqueda">Buscar término</label>
        <input
          id="glosario-busqueda"
          className="glosario-busqueda"
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Ejemplo: TREA"
        />

        {terminoActivo && (
          <div className="glosario-destacado">
            <h3>{terminoActivo.termino}</h3>
            <p>{terminoActivo.definicion}</p>
          </div>
        )}

        <div className="glosario-lista">
          {terminosFiltrados.length === 0 ? (
            <p>No se encontraron términos.</p>
          ) : (
            terminosFiltrados.map((item) => (
              <article key={item.termino} className="glosario-termino">
                <h3>{item.termino}</h3>
                <p>{item.definicion}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
