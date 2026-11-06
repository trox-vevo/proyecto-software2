import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./RegistrationForm.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
type Fields = "username" | "email" | "password" | "confirmation";
type Errors = Partial<Record<Fields, string>>;

export function RegistrationForm({ onRegistered }: { onRegistered: () => void }) {
  const [values, setValues] = useState({ username: "", email: "", password: "", confirmation: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const next: Errors = {};
    if (!values.username.trim() || values.username.trim().length > 80) next.username = "Ingresa un nombre de usuario de hasta 80 caracteres.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.trim().length > 254) next.email = "Ingresa un correo electrónico válido.";
    if (values.password.length < 8 || values.password.length > 1024) next.password = "La contraseña debe tener entre 8 y 1024 caracteres.";
    if (values.password !== values.confirmation) next.confirmation = "Las contraseñas no coinciden.";
    setErrors(next);
    setMessage("");
    if (Object.keys(next).length) return;
    submitting.current = true;
    setPending(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch(`${API_URL}/api/users/register`, {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: values.username.trim(), email: values.email.trim().toLowerCase(), password: values.password }),
      });
      if (controller.signal.aborted) return;
      if (response.status === 409) {
        setErrors({ email: "El correo ingresado ya se encuentra en uso." });
        return;
      }
      if (response.status !== 201) {
        setMessage(response.status === 400 ? "Revisa los datos del registro e inténtalo nuevamente." : "No se pudo crear tu cuenta. Inténtalo más tarde.");
        return;
      }
      onRegistered();
    } catch {
      if (!controller.signal.aborted) {
        setMessage("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.");
      }
    } finally {
      submitting.current = false;
      request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  const fields: { key: Fields; label: string; type: string; autoComplete: string; maxLength: number }[] = [
    { key: "username", label: "Nombre de usuario", type: "text", autoComplete: "username", maxLength: 80 },
    { key: "email", label: "Correo electrónico", type: "email", autoComplete: "email", maxLength: 254 },
    { key: "password", label: "Contraseña", type: "password", autoComplete: "new-password", maxLength: 1024 },
    { key: "confirmation", label: "Confirmar contraseña", type: "password", autoComplete: "new-password", maxLength: 1024 },
  ];
  return (
    <section className="registro" aria-labelledby="registro-titulo">
      <h2 id="registro-titulo">Crea tu cuenta</h2>
      <p>Tu cuenta comienza con el plan básico.</p>
      <form onSubmit={submit} noValidate aria-busy={pending}>
        {fields.map(({ key, label, ...props }) => (
          <div key={key}>
            <label htmlFor={`registro-${key}`}>{label}</label>
            <input {...props} id={`registro-${key}`} name={key} required disabled={pending}
              value={values[key]} aria-invalid={Boolean(errors[key])}
              aria-describedby={errors[key] ? `error-${key}` : undefined}
              onChange={(event) => { setValues({ ...values, [key]: event.target.value }); setErrors({ ...errors, [key]: undefined }); setMessage(""); }} />
            {errors[key] && <p id={`error-${key}`} role="alert">{errors[key]}</p>}
          </div>
        ))}
        <p>Usa una contraseña de al menos 8 caracteres.</p>
        {message && <p role="alert">{message}</p>}
        <button type="submit" disabled={pending}>{pending ? "Creando cuenta…" : "Crear cuenta"}</button>
      </form>
    </section>
  );
}
