import { useEffect, useRef, useState } from "react";
import { TERMINOS } from "./terminos";
import "./GlosarioFinanciero.css";

interface Props { abierto: boolean; terminoSeleccionado: string | null; onCerrar: () => void }

export function GlosarioFinanciero(props: Props) {
  return props.abierto ? <PanelGlosario key={props.terminoSeleccionado} {...props} /> : null;
}

function PanelGlosario({ terminoSeleccionado, onCerrar }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState(terminoSeleccionado);
  const panel = useRef<HTMLElement>(null);
  const cerrar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cerrar.current?.focus();
    function manejarTecla(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCerrar(); }
      if (event.key !== "Tab") return;
      const elementos = panel.current?.querySelectorAll<HTMLElement>('button, input, a[href]');
      if (!elementos?.length) return;
      const primero = elementos[0]; const ultimo = elementos[elementos.length - 1];
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus(); }
    }
    document.addEventListener("keydown", manejarTecla);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", manejarTecla);
      document.body.style.overflow = previousOverflow;
      anterior?.focus();
    };
  }, [onCerrar]);
  const normalizar = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const terminos = TERMINOS.filter((item) => normalizar(`${item.termino} ${item.definicion}`).includes(normalizar(busqueda.trim())));
  const activo = TERMINOS.find((item) => item.termino === seleccionado);
  return <div className="glosario-fondo" onClick={(event) => { if (event.target === event.currentTarget) onCerrar(); }}>
    <section ref={panel} className="glosario-panel" role="dialog" aria-modal="true" aria-labelledby="glosario-titulo">
      <header className="glosario-encabezado"><h2 id="glosario-titulo">Glosario financiero</h2><button ref={cerrar} type="button" className="glosario-cerrar" onClick={onCerrar} aria-label="Cerrar glosario">×</button></header>
      <p className="glosario-introduccion">Consulta los conceptos utilizados en las simulaciones.</p>
      <label htmlFor="glosario-busqueda">Buscar término</label>
      <input id="glosario-busqueda" className="glosario-busqueda" type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} />
      {activo && <article className="glosario-destacado" aria-live="polite"><h3>{activo.termino}</h3><p>{activo.definicion}</p>{activo.fuente && <a href={activo.fuente} target="_blank" rel="noreferrer">Fuente: SBS</a>}</article>}
      <nav className="glosario-lista" aria-label="Términos financieros">
        {terminos.length ? terminos.map((item) => <button className="glosario-enlace" key={item.termino} type="button" aria-pressed={seleccionado === item.termino} onClick={() => setSeleccionado(item.termino)}>{item.termino}</button>) : <p role="status">No se encontraron términos.</p>}
      </nav>
    </section>
  </div>;
}
