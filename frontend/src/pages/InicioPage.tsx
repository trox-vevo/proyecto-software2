import { useAbrirGlosario } from "../app/glosario";
import { alHacerClic, navegar } from "../app/navegacion";
import { useSesion } from "../app/useSesion";
import { PRO_MONTHLY_PRICE } from "../commerce/types";

/** Inicio (US04, US24): propuesta de valor y acceso a cada simulador. Sin simuladores aquí. */
export function InicioPage() {
  const sesion = useSesion();
  const abrirGlosario = useAbrirGlosario();

  return (
    <main className="pagina">
      <section className="tarjeta">
        <p className="etiqueta-seccion">Yupay Finance</p>
        <h1>Compara dónde guardar tu dinero</h1>
        <p>Mira cuánto ganarías en cuentas de ahorro y depósitos a plazo fijo de bancos y cajas del Perú, y qué tan seguras son.</p>
        {sesion ? (
          <>
            <p>Hola, tu plan es {sesion.plan}.</p>
            {sesion.plan === "PRO" ? (
              <button className="boton-secundario" type="button" onClick={() => navegar("/favoritos")}>Ver mis simulaciones guardadas</button>
            ) : (
              <>
                <button className="boton-secundario" type="button" onClick={() => navegar("/planes")}>Conocer el Plan Pro</button>
                <p>Desde S/ {PRO_MONTHLY_PRICE} al mes.</p>
              </>
            )}
          </>
        ) : (
          <p>
            <a href="/registro" onClick={alHacerClic("/registro")}>Crea tu cuenta gratis</a>
            {" o "}
            <a href="/login" onClick={alHacerClic("/login")}>ingresa a tu cuenta</a>.
          </p>
        )}
      </section>
      <div className="tarjetas-inicio">
        <article className="tarjeta">
          <h2>Cuenta de ahorros</h2>
          <p>Dinero disponible cuando lo necesites.</p>
          <button className="boton-primario" type="button" onClick={() => navegar("/simular/ahorros")}>Simular ahorros</button>
        </article>
        <article className="tarjeta">
          <h2>Depósito a plazo fijo</h2>
          <p>Más ganancia si no lo tocas por un tiempo.</p>
          <button className="boton-primario" type="button" onClick={() => navegar("/simular/plazo-fijo")}>Simular plazo fijo</button>
        </article>
        <article className="tarjeta">
          <h2>Aprende</h2>
          <p>Qué significa TEA, TREA o FSD.</p>
          <button className="boton-secundario" type="button" onClick={() => abrirGlosario()}>Abrir glosario</button>
        </article>
      </div>
    </main>
  );
}
