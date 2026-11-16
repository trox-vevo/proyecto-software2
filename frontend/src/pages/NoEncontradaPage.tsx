import { alHacerClic } from "../app/navegacion";

export function NoEncontradaPage() {
  return (
    <main className="pagina">
      <section className="tarjeta">
        <h1>No encontramos esta página</h1>
        <p>Puede que el enlace esté mal escrito o que la página ya no exista.</p>
        <a href="/" onClick={alHacerClic("/")}>Volver a Inicio</a>
      </section>
    </main>
  );
}
