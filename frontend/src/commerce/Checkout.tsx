import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { API_URL } from "./types";
import { fetchWithAuth } from "../auth/session";
import { sessionStore } from "../pro_access/SessionStore";
import { formatDemoCardNumber, validateDemoCard } from "./demoCards";
import type { DemoCardInput, DemoScenarioId } from "./demoCards";
import "./commerce.css";

interface CheckoutConfig {
  environment: "DEMO";
  provider: "LOCAL_MOCK";
  simulation: true;
  cardCaptureAvailable: true;
  processingAvailable: true;
  realPaymentsAvailable: false;
  membershipActivationAvailable: true;
}

interface DemoResult {
  reference: string;
  outcome: "APPROVED" | "DECLINED";
  simulation: true;
  environment: "DEMO";
  occurredAt: string;
  planId: "PRO";
  amount: null;
  message: string;
  declineReason: string | null;
  plan: "BASICO" | "PRO"; // US33: plan del usuario tras el pago
  planExpiresAt: string | null;
}

type CheckoutErrors = Partial<
  Record<"name" | "email" | keyof DemoCardInput | "form", string>
>;
const emptyBilling = { name: "", email: "" };
const emptyCard: DemoCardInput = {
  holder: "",
  number: "",
  expiry: "",
  cvv: "",
};
// Beneficios exclusivos del Plan Pro (mismos textos que /api/plans).
const PRO_BENEFITS = [
  "Guardar simulaciones favoritas",
  "Informe de riesgo avanzado",
  "Reporte de solvencia en PDF",
];
const AUTHENTICATION_REQUIRED = "Inicia sesión para suscribirte al Plan Pro.";

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isDemoConfig(value: unknown): value is CheckoutConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const expected = {
    environment: "DEMO",
    provider: "LOCAL_MOCK",
    simulation: true,
    cardCaptureAvailable: true,
    processingAvailable: true,
    realPaymentsAvailable: false,
    membershipActivationAvailable: true,
  };
  return (
    Object.keys(data).length === Object.keys(expected).length &&
    Object.entries(expected).every(
      ([key, expectedValue]) => data[key] === expectedValue,
    )
  );
}

function isDemoResult(
  value: unknown,
  scenarioId: DemoScenarioId,
): value is DemoResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const expectedKeys = [
    "reference",
    "outcome",
    "simulation",
    "environment",
    "occurredAt",
    "planId",
    "amount",
    "message",
    "declineReason",
    "plan",
    "planExpiresAt",
  ];
  if (
    Object.keys(data).length !== expectedKeys.length ||
    Object.keys(data).some((key) => !expectedKeys.includes(key))
  )
    return false;
  if (
    data.simulation !== true ||
    data.environment !== "DEMO" ||
    data.planId !== "PRO" ||
    data.amount !== null ||
    typeof data.reference !== "string" ||
    !/^DEMO-[a-f0-9]{24}$/i.test(data.reference) ||
    typeof data.message !== "string" ||
    !data.message.trim() ||
    data.message.length > 500 ||
    !isIsoDate(data.occurredAt)
  )
    return false;
  return scenarioId === "DEMO_APPROVED"
    ? // US33: una aprobación debe traer el Plan Pro activo y su vencimiento.
      data.outcome === "APPROVED" &&
        data.declineReason === null &&
        data.plan === "PRO" &&
        isIsoDate(data.planExpiresAt)
    : data.outcome === "DECLINED" &&
        data.declineReason === "Fondos ficticios insuficientes." &&
        (data.plan === "BASICO" || data.plan === "PRO") &&
        (data.planExpiresAt === null || isIsoDate(data.planExpiresAt));
}

export function Checkout({
  onViewPlans,
  onReturnToApp = onViewPlans,
}: {
  onViewPlans: () => void;
  onReturnToApp?: () => void;
}) {
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [billing, setBilling] = useState(emptyBilling);
  const [card, setCard] = useState<DemoCardInput>(emptyCard);
  const [simulateDecline, setSimulateDecline] = useState(false);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    // pagehide también cubre la salida hacia BFCache, que puede conservar React montado.
    const clearOnPageHide = () => {
      request.current?.abort();
      request.current = null;
      setBilling(emptyBilling);
      setCard(emptyCard);
      setSimulateDecline(false);
      setErrors({});
      setResult(null);
      setPending(false);
    };
    window.addEventListener("pagehide", clearOnPageHide);
    return () => {
      window.removeEventListener("pagehide", clearOnPageHide);
      request.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/api/checkout/config`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Configuración no disponible");
        const data: unknown = await response.json();
        if (!isDemoConfig(data))
          throw new Error("Configuración DEMO no compatible");
        if (!controller.signal.aborted) setConfig(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfigError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  function clearForm() {
    setBilling(emptyBilling);
    setCard(emptyCard);
    setSimulateDecline(false);
  }

  function leaveCheckout() {
    request.current?.abort();
    request.current = null;
    clearForm();
    setResult(null);
    setErrors({});
    setPending(false);
    onViewPlans();
  }

  function updateCard(field: keyof DemoCardInput, value: string) {
    setCard({
      ...card,
      [field]: field === "number" ? formatDemoCardNumber(value) : value,
    });
    setErrors({ ...errors, [field]: undefined, form: undefined });
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || !config) return;
    const validation = validateDemoCard(card);
    const next: CheckoutErrors = { ...validation.errors };
    if (!billing.name.trim() || billing.name.trim().length > 120)
      next.name = "Ingresa un nombre o razón social de hasta 120 caracteres.";
    if (
      billing.email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing.email.trim())
    )
      next.email = "Ingresa un correo de facturación válido.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const scenarioId: DemoScenarioId = simulateDecline
      ? "DEMO_DECLINED"
      : "DEMO_APPROVED";
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    try {
      // Los datos de tarjeta se validan solo aquí. El escenario procede del control DEMO.
      // US33: el token identifica a quién se le activa el Plan Pro.
      const response = await fetchWithAuth(`${API_URL}/api/checkout/simulate`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: "PRO",
          scenarioId,
          billing: {
            name: billing.name.trim(),
            email: billing.email.trim().toLowerCase(),
          },
        }),
      });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setErrors({
          form:
            response.status === 401
              ? AUTHENTICATION_REQUIRED
              : response.status === 400
                ? "Revisa los datos ingresados y vuelve a intentarlo."
                : "No pudimos procesar tu pago. Vuelve a ingresar los datos e inténtalo más tarde.",
        });
        return;
      }
      const data: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!isDemoResult(data, scenarioId)) {
        setErrors({
          form: "No pudimos confirmar tu pago. Vuelve a ingresar los datos.",
        });
        return;
      }
      // Desbloqueo en tiempo real: RiskBadge y el resto de la app leen este plan.
      if (data.outcome === "APPROVED") sessionStore.setPlan("PRO");
      setResult(data);
    } catch {
      if (!controller.signal.aborted)
        setErrors({
          form: "No se pudo conectar con el servicio de pagos. Vuelve a ingresar los datos para reintentar.",
        });
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) {
        clearForm();
        setPending(false);
      }
    }
  }

  function paymentDetails(result: DemoResult) {
    return (
      <>
        <dl className="checkout-referencia">
          <div>
            <dt>Número de operación</dt>
            <dd>{result.reference.replace(/^DEMO-/, "").toUpperCase()}</dd>
          </div>
          <div>
            <dt>Fecha y hora local</dt>
            <dd>
              <time dateTime={result.occurredAt}>
                {new Intl.DateTimeFormat("es", {
                  dateStyle: "medium",
                  timeStyle: "medium",
                }).format(new Date(result.occurredAt))}
              </time>
            </dd>
          </div>
          <div>
            <dt>Plan seleccionado</dt>
            <dd>Pro</dd>
          </div>
          <div>
            <dt>Medio de pago</dt>
            <dd>Tarjeta de crédito o débito</dd>
          </div>
        </dl>
      </>
    );
  }

  // US33, Escenario 1: pantalla festiva con el vencimiento y lo que se desbloqueó.
  function showSuccess(result: DemoResult) {
    return (
      <section
        className="checkout-resultado checkout-resultado-approved"
        role="status"
        aria-labelledby="demo-result-title"
      >
        <span className="checkout-resultado-icono" aria-hidden="true">
          🎉
        </span>
        <h2 id="demo-result-title">¡Bienvenido al Plan Pro!</h2>
        <p>
          Tu Plan Pro está activo hasta{" "}
          <strong>
            <time dateTime={result.planExpiresAt ?? undefined}>
              {new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(
                new Date(result.planExpiresAt ?? result.occurredAt),
              )}
            </time>
          </strong>
          .
        </p>
        <p>Ya tienes desbloqueado:</p>
        <ul>
          {PRO_BENEFITS.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
        {paymentDetails(result)}
        <div className="checkout-resultado-acciones">
          <button type="button" onClick={onReturnToApp}>
            Volver a la aplicación
          </button>
        </div>
      </section>
    );
  }

  // US33, Escenario 2: motivo en lenguaje sencillo, sin códigos técnicos.
  function showDecline(result: DemoResult) {
    return (
      <section
        className="checkout-resultado checkout-resultado-declined"
        role="status"
        aria-labelledby="demo-result-title"
      >
        <span className="checkout-resultado-icono" aria-hidden="true">
          !
        </span>
        <h2 id="demo-result-title">No pudimos procesar tu pago</h2>
        <p>
          {/* El backend solo devuelve este motivo (lo valida isDemoResult). */}
          <strong>Motivo:</strong> Fondos insuficientes.
        </p>
        <p>No se realizó ningún cargo y tu plan no cambió.</p>
        {paymentDetails(result)}
        <div className="checkout-resultado-acciones">
          <button type="button" onClick={onReturnToApp}>
            Volver a la aplicación
          </button>
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setErrors({});
            }}
          >
            Intentar nuevamente
          </button>
        </div>
      </section>
    );
  }

  return (
    <main className="pagina comercio checkout-demo">
      <div className="checkout-encabezado">
        <div>
          <h1>Pago del Plan Pro</h1>
          <p className="checkout-subtitulo">
            Completa tus datos para activar tu suscripción.
          </p>
        </div>
        <button
          type="button"
          className="checkout-volver"
          onClick={leaveCheckout}
        >
          Volver a planes
        </button>
      </div>
      {configError ? (
        <div role="alert" className="comercio-aviso">
          <p>No pudimos cargar la página de pago.</p>
          <button
            type="button"
            onClick={() => {
              setConfigError(false);
              setConfig(null);
              setAttempt(attempt + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : !config ? (
        <p role="status">Cargando página de pago…</p>
      ) : result ? (
        result.outcome === "APPROVED" ? (
          showSuccess(result)
        ) : (
          showDecline(result)
        )
      ) : (
        <div className="checkout-layout">
          <form
            className="checkout-formulario"
            onSubmit={submitPayment}
            noValidate
            autoComplete="off"
            aria-busy={pending}
          >
            <fieldset disabled={pending}>
              <legend>Datos de facturación</legend>
              <label htmlFor="billing-name">Nombre o razón social</label>
              <input
                id="billing-name"
                name="demo-billing-name"
                autoComplete="off"
                required
                maxLength={120}
                value={billing.name}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={
                  errors.name ? "billing-name-error" : undefined
                }
                onChange={(event) => {
                  setBilling({ ...billing, name: event.target.value });
                  setErrors({ ...errors, name: undefined, form: undefined });
                }}
              />
              {errors.name && (
                <p id="billing-name-error" role="alert">
                  {errors.name}
                </p>
              )}
              <label htmlFor="billing-email">Correo de facturación</label>
              <input
                id="billing-email"
                name="demo-billing-email"
                type="email"
                autoComplete="off"
                required
                maxLength={254}
                value={billing.email}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={
                  errors.email ? "billing-email-error" : undefined
                }
                onChange={(event) => {
                  setBilling({ ...billing, email: event.target.value });
                  setErrors({ ...errors, email: undefined, form: undefined });
                }}
              />
              {errors.email && (
                <p id="billing-email-error" role="alert">
                  {errors.email}
                </p>
              )}
            </fieldset>
            <fieldset disabled={pending}>
              <legend>Tarjeta de crédito o débito</legend>
              <label htmlFor="demo-card-number">Número de tarjeta</label>
              <input
                id="demo-card-number"
                name="demo-code"
                autoComplete="off"
                inputMode="numeric"
                spellCheck={false}
                required
                className="checkout-codigo-input"
                placeholder="1234 5678 9012 3456"
                value={card.number}
                aria-invalid={Boolean(errors.number)}
                aria-describedby={
                  errors.number ? "demo-number-error" : undefined
                }
                onChange={(event) => updateCard("number", event.target.value)}
              />
              {errors.number && (
                <p id="demo-number-error" role="alert">
                  {errors.number}
                </p>
              )}
              <label htmlFor="demo-holder">Nombre del titular</label>
              <input
                id="demo-holder"
                name="demo-holder"
                autoComplete="off"
                required
                maxLength={120}
                placeholder="Como aparece en la tarjeta"
                value={card.holder}
                aria-invalid={Boolean(errors.holder)}
                aria-describedby={
                  errors.holder ? "demo-holder-error" : undefined
                }
                onChange={(event) => updateCard("holder", event.target.value)}
              />
              {errors.holder && (
                <p id="demo-holder-error" role="alert">
                  {errors.holder}
                </p>
              )}
              <div className="checkout-fecha-cvv">
                <div>
                  <label htmlFor="demo-expiry">Fecha de vencimiento</label>
                  <input
                    id="demo-expiry"
                    name="demo-expiry"
                    autoComplete="off"
                    required
                    placeholder="MM/AA"
                    value={card.expiry}
                    aria-invalid={Boolean(errors.expiry)}
                    aria-describedby={
                      errors.expiry ? "demo-expiry-error" : undefined
                    }
                    onChange={(event) =>
                      updateCard("expiry", event.target.value)
                    }
                  />
                  {errors.expiry && (
                    <p id="demo-expiry-error" role="alert">
                      {errors.expiry}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="demo-cvv">CVV</label>
                  <input
                    id="demo-cvv"
                    name="demo-cvv"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    placeholder="123"
                    value={card.cvv}
                    aria-invalid={Boolean(errors.cvv)}
                    aria-describedby={
                      errors.cvv ? "demo-cvv-error" : undefined
                    }
                    onChange={(event) => updateCard("cvv", event.target.value)}
                  />
                  {errors.cvv && (
                    <p id="demo-cvv-error" role="alert">
                      {errors.cvv}
                    </p>
                  )}
                </div>
              </div>
            </fieldset>
            {errors.form && (
              <p role="alert" className="checkout-error-formulario">
                {errors.form}
              </p>
            )}
            <div className="checkout-confirmacion">
              <p className="comercio-ayuda">
                🔒 Los datos de tu tarjeta no se guardan ni se envían a
                nuestros servidores.
              </p>
              <button type="submit" disabled={pending}>
                {pending ? "Procesando pago…" : "Pagar ahora"}
              </button>
            </div>
            {pending && (
              <p role="status" className="checkout-procesando">
                <span aria-hidden="true" />
                Procesando pago…
              </p>
            )}
            {/* Permite mostrar el Escenario 2 de la US33 (pago rechazado). */}
            <label htmlFor="demo-decline" className="checkout-opciones-demo">
              <input
                id="demo-decline"
                name="demo-decline"
                type="checkbox"
                checked={simulateDecline}
                disabled={pending}
                onChange={(event) => setSimulateDecline(event.target.checked)}
              />
              Forzar pago rechazado
            </label>
          </form>
          <aside
            className="checkout-resumen"
            aria-labelledby="order-summary-title"
          >
            <h2 id="order-summary-title">Resumen del pedido</h2>
            <p className="checkout-resumen-plan">
              <strong>Plan Pro</strong>
              <span>30 días</span>
            </p>
            <ul>
              {PRO_BENEFITS.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <p className="comercio-ayuda">
              Tu Plan Pro se activa en cuanto se apruebe el pago.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
