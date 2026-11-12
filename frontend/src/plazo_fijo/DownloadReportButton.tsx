import { useState } from "react";
import { fetchWithAuth } from "../auth/session";
import { sessionStore } from "../pro_access/SessionStore";
import type { ParametrosPlazoFijo } from "./tipos";

const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const FILE_NAME = "ReporteSolvencia.pdf";

// US30: descarga el Reporte de Solvencia en PDF. Exclusivo Pro; el backend también lo bloquea (403).
// Solo envía los parámetros: el backend vuelve a simular para que el PDF no tenga números alterados.
export function DownloadReportButton({ parametros }: { parametros: ParametrosPlazoFijo }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exclusivo Pro. Si un 403 acaba de quitar el Pro, se conserva el aviso para explicar por qué.
  const isPro = sessionStore.isPro();
  if (!isPro && !error) return null;

  const showSpinner = () => { setError(null); setLoading(true); };
  const hideSpinner = () => setLoading(false);

  function saveFile(pdf: Blob): void {
    const url = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = url;
    link.download = FILE_NAME; // descarga nativa con el nombre exacto
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadReport(): Promise<void> {
    if (loading) return; // evita una doble descarga
    showSpinner();
    try {
      const response = await fetchWithAuth(`${API_URL}/api/reports/solvency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parametros),
      });
      if (response.status === 403) { // el Plan Pro ya no está activo
        sessionStore.setPlan("BASICO");
        setError("Tu Plan Pro no está activo. Revisa los planes para descargar reportes.");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      saveFile(await response.blob());
    } catch {
      setError("No pudimos preparar tu reporte. Inténtalo de nuevo.");
    } finally {
      hideSpinner();
    }
  }

  return (
    <div className="reporte-pdf">
      {isPro && <button type="button" onClick={downloadReport} disabled={loading}>
        {loading ? "Preparando tu reporte…" : "Descargar Reporte PDF"}
      </button>}
      {loading && <p role="status">Preparando tu reporte…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
