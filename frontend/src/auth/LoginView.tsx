import { useState, type FormEvent } from "react";
import "./LoginView.css";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface AuthSession {
  id: string;
  userId: string;
  tokenJwt: string;
  expiresAt: string;
}

interface Props {
  onLogin: (session: AuthSession) => void;
  onForgotPassword: () => void;
}

export function LoginView({ onLogin, onForgotPassword }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCargando(true);

    try {
      const respuesta = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const cuerpo: unknown = await respuesta.json();
      if (!respuesta.ok) {
        const mensaje =
          typeof cuerpo === "object" &&
          cuerpo !== null &&
          "message" in cuerpo &&
          typeof cuerpo.message === "string"
            ? cuerpo.message
            : `No se pudo iniciar sesión (error ${respuesta.status})`;
        throw new Error(mensaje);
      }

      if (
        typeof cuerpo !== "object" ||
        cuerpo === null ||
        !("session" in cuerpo) ||
        typeof cuerpo.session !== "object" ||
        cuerpo.session === null ||
        !("tokenJwt" in cuerpo.session) ||
        typeof cuerpo.session.tokenJwt !== "string" ||
        !("id" in cuerpo.session) ||
        typeof cuerpo.session.id !== "string" ||
        !("userId" in cuerpo.session) ||
        typeof cuerpo.session.userId !== "string" ||
        !("expiresAt" in cuerpo.session) ||
        typeof cuerpo.session.expiresAt !== "string"
      ) {
        throw new Error("El servidor devolvió una respuesta de inicio de sesión inválida");
      }

      onLogin({
        id: cuerpo.session.id,
        userId: cuerpo.session.userId,
        tokenJwt: cuerpo.session.tokenJwt,
        expiresAt: cuerpo.session.expiresAt,
      });
    } catch (cause: unknown) {
      setError(
        cause instanceof TypeError
          ? "No se pudo conectar con el servidor. Inténtalo de nuevo."
          : cause instanceof Error
            ? cause.message
            : "Ocurrió un error inesperado al iniciar sesión.",
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-pagina">
      <section className="login-tarjeta" aria-labelledby="login-titulo">
        <p className="login-etiqueta">Cuentas de ahorro</p>
        <h1 id="login-titulo">Iniciar sesión</h1>
        <p className="login-descripcion">Ingresa tus credenciales para continuar.</p>

        <form className="login-formulario" onSubmit={iniciarSesion}>
          <label htmlFor="login-email">Correo electrónico</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={cargando}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <a
          className="login-enlace-recuperacion"
          href="/recuperar-contrasena"
          onClick={(event) => {
            event.preventDefault();
            onForgotPassword();
          }}
        >
          ¿Olvidaste tu contraseña?
        </a>
      </section>
    </main>
  );
}
