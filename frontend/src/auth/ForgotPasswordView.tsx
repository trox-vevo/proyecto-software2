import { useState, type FormEvent } from "react";
import "./LoginView.css";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function solicitarRecuperacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCargando(true);

    try {
      const respuesta = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (respuesta.status === 202) {
        setEnviado(true);
        return;
      }

      const body: unknown = await respuesta.json().catch(() => null);
      const message =
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : `No se pudo procesar la solicitud (error ${respuesta.status})`;
      throw new Error(message);
    } catch (cause: unknown) {
      setError(
        cause instanceof TypeError
          ? "No se pudo conectar con el servidor. Inténtalo de nuevo."
          : cause instanceof Error
            ? cause.message
            : "Ocurrió un error inesperado.",
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-pagina">
      <section className="login-tarjeta" aria-labelledby="recuperacion-titulo">
        <p className="login-etiqueta">Yupay Finance</p>
        <h1 id="recuperacion-titulo">Recuperar contraseña</h1>
        {enviado ? (
          <p role="status">
            Si el correo existe, recibirás un enlace de recuperación.
          </p>
        ) : (
          <>
            <p className="login-descripcion">
              Ingresa el correo asociado a tu cuenta y te enviaremos un enlace.
            </p>
            <form className="login-formulario" onSubmit={solicitarRecuperacion}>
              <label htmlFor="recuperacion-email">Correo electrónico</label>
              <input
                id="recuperacion-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={cargando}>
                {cargando ? "Enviando…" : "Enviar enlace"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
