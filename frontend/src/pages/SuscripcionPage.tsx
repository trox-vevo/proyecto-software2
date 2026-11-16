import { alHacerClic, navegar } from "../app/navegacion";
import { useSesion } from "../app/useSesion";
import { CancelSubscriptionSection } from "../commerce/CancelSubscriptionSection";
import { PRO_MONTHLY_PRICE, isIsoDate } from "../commerce/types";

/** Mi suscripción (US41–US43). El aviso e historial de la US42 los muestra el Layout debajo de la cabecera. */
export function SuscripcionPage() {
  const sesion = useSesion();

  if (!sesion) {
    return (
      <main className="pagina">
        <h1>Mi suscripción</h1>
        <section className="tarjeta">
          <p>Inicia sesión para ver tu suscripción.</p>
          <a href="/login" onClick={alHacerClic("/login")}>Ir a iniciar sesión</a>
        </section>
      </main>
    );
  }

  const esPro = sesion.plan === "PRO";
  return (
    <main className="pagina">
      <h1>Mi suscripción</h1>
      <section className="tarjeta">
        <p className="etiqueta-seccion">Tu plan actual</p>
        <p>{esPro ? `Plan Pro · S/ ${PRO_MONTHLY_PRICE} al mes` : "Plan Básico · S/ 0.00"}</p>
        {esPro && isIsoDate(sesion.planExpiresAt) && (
          <p>
            Vigente hasta{" "}
            <time dateTime={sesion.planExpiresAt}>
              {new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(new Date(sesion.planExpiresAt))}
            </time>.
          </p>
        )}
        {esPro ? <CancelSubscriptionSection /> : (
          <>
            <p>Con el Plan Pro guardas simulaciones, ves el riesgo de cada entidad y descargas el informe en PDF.</p>
            <button className="boton-primario" type="button" onClick={() => navegar("/planes")}>Conocer el Plan Pro</button>
          </>
        )}
      </section>
      <p>
        <button className="boton-secundario" type="button" onClick={() => navegar("/facturacion")}>Historial de facturación</button>
      </p>
    </main>
  );
}
