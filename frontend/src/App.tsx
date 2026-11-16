import { useRef, useState, type ReactNode } from "react";
import "./App.css";
import "./commerce/commerce.css";
import { Layout } from "./app/Layout";
import { navegar, useRuta } from "./app/navegacion";
import { AlertasSeccion } from "./alertas/AlertasSeccion";
import { BillingHistory } from "./commerce/BillingHistory";
import { Checkout } from "./commerce/Checkout";
import { PlanComparison } from "./commerce/PlanComparison";
import { SavedSimulations, type FavoriteParameters } from "./commerce/SavedSimulations";
import { RutasAcceso } from "./pages/AccesoPages";
import { InicioPage } from "./pages/InicioPage";
import { NoEncontradaPage } from "./pages/NoEncontradaPage";
import { SimuladorPage } from "./pages/SimuladorPage";
import { SuscripcionPage } from "./pages/SuscripcionPage";
import { ProfileEditor } from "./profile/ProfileEditor";
import type { ParametrosPlazoFijo } from "./plazo_fijo/tipos";

/** US29: "Volver a simular" desde favoritos. Solo vale para la pantalla a la que lleva. */
type Replay =
  | { ruta: "/simular/ahorros"; ahorros: { accountId: string; days: number } }
  | { ruta: "/simular/plazo-fijo"; plazoFijo: { id: number; parameters: ParametrosPlazoFijo } };

export default function App() {
  const ruta = useRuta();
  const [replay, setReplay] = useState<Replay>();
  const replaySequence = useRef(0);
  // Si el usuario navega a otra pantalla, el replay se descarta (igual que antes con preserveReplay).
  if (replay && replay.ruta !== ruta) setReplay(undefined);

  function volverASimular(parameters: FavoriteParameters) {
    replaySequence.current += 1;
    const siguiente: Replay = parameters.instrument === "AHORROS"
      ? { ruta: "/simular/ahorros", ahorros: { accountId: parameters.accountId, days: parameters.days } }
      : {
        ruta: "/simular/plazo-fijo",
        plazoFijo: {
          id: replaySequence.current,
          parameters: {
            amount: parameters.amount,
            department: parameters.department,
            paymentMode: parameters.paymentMode,
            termDays: parameters.termDays,
          },
        },
      };
    setReplay(siguiente);
    navegar(siguiente.ruta);
  }

  let pantalla: ReactNode;
  switch (ruta) {
    case "/": pantalla = <InicioPage />; break;
    case "/simular/ahorros":
    case "/simular/plazo-fijo":
      pantalla = <SimuladorPage
        instrumento={ruta === "/simular/ahorros" ? "AHORROS" : "PLAZO_FIJO"}
        savingsReplay={replay && "ahorros" in replay ? replay.ahorros : undefined}
        fixedReplay={replay && "plazoFijo" in replay ? replay.plazoFijo : undefined}
      />;
      break;
    case "/planes": pantalla = <PlanComparison onCheckout={() => navegar("/checkout")} />; break;
    case "/checkout":
      pantalla = <Checkout onViewPlans={() => navegar("/planes")} onReturnToApp={() => navegar("/")} />;
      break;
    case "/perfil":
      pantalla = <main className="pagina">
        <ProfileEditor
          onViewBillingHistory={() => navegar("/facturacion")}
          onViewSubscription={() => navegar("/suscripcion")}
        />
        <AlertasSeccion />
      </main>;
      break;
    case "/suscripcion": pantalla = <SuscripcionPage />; break;
    case "/facturacion":
      pantalla = <main className="pagina"><BillingHistory /></main>;
      break;
    case "/favoritos":
      pantalla = <main className="pagina">
        <SavedSimulations onReplay={volverASimular} onViewPlans={() => navegar("/planes")} />
      </main>;
      break;
    default: pantalla = <NoEncontradaPage />;
  }

  return <RutasAcceso><Layout>{pantalla}</Layout></RutasAcceso>;
}
