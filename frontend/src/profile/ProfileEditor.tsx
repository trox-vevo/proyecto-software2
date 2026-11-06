import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./ProfileEditor.css";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

interface Perfil {
  id: string;
  nombre: string;
  correo: string;
}

function esPerfil(valor: unknown): valor is Perfil {
  if (typeof valor !== "object" || valor === null) return false;
  const perfil = valor as Record<string, unknown>;
  return (
    typeof perfil.id === "string" &&
    typeof perfil.nombre === "string" &&
    typeof perfil.correo === "string"
  );
}

async function leerMensajeError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return `El servidor respondió con el código ${response.status}.`;
}

export function ProfileEditor() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  useEffect(() => {
    const controlador = new AbortController();
    fetch(`${API_URL}/api/perfil`, { signal: controlador.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await leerMensajeError(response));
        const datos: unknown = await response.json();
        if (!esPerfil(datos)) throw new Error("El servidor devolvió un perfil inválido.");
        return datos;
      })
      .then((datos) => setPerfil(datos))
      .catch((cause: unknown) => {
        if (controlador.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "No se pudo cargar el perfil.");
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCargando(false);
      });

    return () => controlador.abort();
  }, []);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (perfil === null) return;

    setGuardando(true);
    setError("");
    setConfirmacion("");
    try {
      const response = await fetch(`${API_URL}/api/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: perfil.nombre, correo: perfil.correo }),
      });
      if (!response.ok) throw new Error(await leerMensajeError(response));

      const datos: unknown = await response.json();
      if (!esPerfil(datos)) throw new Error("El servidor devolvió un perfil inválido.");
      setPerfil(datos);
      setConfirmacion("Perfil actualizado correctamente.");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el perfil.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="editor-perfil" aria-labelledby="titulo-perfil">
      <h2 id="titulo-perfil">Mi perfil</h2>
      {cargando && <p role="status">Cargando perfil…</p>}
      {error && <p className="mensaje-perfil error" role="alert">{error}</p>}
      {!cargando && perfil !== null && (
        <form onSubmit={guardar}>
          <label>
            Nombre de usuario
            <input
              type="text"
              required
              value={perfil.nombre}
              onChange={(evento) => {
                setPerfil({ ...perfil, nombre: evento.target.value });
                setError("");
                setConfirmacion("");
              }}
            />
          </label>
          <label>
            Correo electrónico
            <input
              type="email"
              required
              value={perfil.correo}
              onChange={(evento) => {
                setPerfil({ ...perfil, correo: evento.target.value });
                setError("");
                setConfirmacion("");
              }}
            />
          </label>
          <button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
          {confirmacion && <p className="mensaje-perfil" role="status">{confirmacion}</p>}
        </form>
      )}
    </section>
  );
}
