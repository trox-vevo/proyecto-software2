import { useState, type FormEvent } from "react";
import "./LoginView.css";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface Props {
  token: string | null;
  onReset: () => void;
}

export function ResetPasswordView({ token, onReset }: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function restablecer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("El enlace de recuperación es inválido o ha expirado.");
      return;
    }
    if (password.length < 8 || password.length > 1024) {
      setError("La contraseña debe tener entre 8 y 1024 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (response.status === 200) {
        onReset();
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      const message =
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : `No se pudo actualizar la contraseña (error ${response.status})`;
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
      <section className="login-tarjeta" aria-labelledby="restablecer-titulo">
        <p className="login-etiqueta">Yupay Finance</p>
        <h1 id="restablecer-titulo">Nueva contraseña</h1>
        <p className="login-descripcion">Elige una contraseña segura de al menos 8 caracteres.</p>
        <form className="login-formulario" onSubmit={restablecer}>
          <label htmlFor="nueva-password">Nueva contraseña</label>
          <input
            id="nueva-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={1024}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <label htmlFor="confirmar-password">Confirmar contraseña</label>
          <input
            id="confirmar-password"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={1024}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={cargando}>
            {cargando ? "Actualizando…" : "Actualizar contraseña"}
          </button>
        </form>
      </section>
    </main>
  );
}
