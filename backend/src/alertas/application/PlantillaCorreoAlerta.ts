import type { ContenidoCorreo, DatosAlertaCorreo } from "../domain/EnvioCorreo";

// TS-124: arma el correo de alerta crítica (asunto, HTML y texto plano) a partir de una alerta.

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** El nombre de la entidad entra al HTML, así que se escapa para que no pueda inyectar etiquetas. */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caracter) => ESCAPES[caracter] ?? caracter);
}

/** Un asunto con saltos de línea permitiría inyectar otros encabezados del correo. */
const enUnaLinea = (texto: string) => texto.replace(/[\r\n]+/g, " ").trim();

export class PlantillaCorreoAlerta {
  construir(alerta: DatosAlertaCorreo, enlace: string): ContenidoCorreo {
    const esTasa = alerta.tipo === "CAMBIO_TASA";
    const cambio = esTasa ? "cambio de tasa" : "cambio de riesgo";
    const entidad = enUnaLinea(alerta.entidad);

    const asunto = `Alerta crítica: ${cambio} en ${entidad}`;
    const filas: Array<[string, string]> = esTasa
      ? [["Tasa anterior", alerta.valorAnterior], ["Tasa nueva", alerta.valorNuevo]]
      : [["Calificación anterior", alerta.valorAnterior], ["Calificación nueva", alerta.valorNuevo]];
    if (esTasa && alerta.variacionPct !== null) filas.push(["Variación", alerta.variacionPct]);

    const texto = [
      "Alerta crítica en Yupay Finance",
      "",
      `Entidad: ${entidad}`,
      `Tipo de cambio: ${cambio}`,
      ...filas.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`),
      "",
      `Ver el detalle completo: ${enlace}`,
    ].join("\n");

    const filasHtml = filas
      .map(
        ([etiqueta, valor]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#555;">${escaparHtml(etiqueta)}</td>` +
          `<td style="padding:4px 0;"><strong>${escaparHtml(valor)}</strong></td></tr>`,
      )
      .join("");

    const html =
      `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#1a1a1a;">` +
      `<h2 style="margin-bottom:4px;">Alerta crítica en Yupay Finance</h2>` +
      `<p style="margin-top:0;">Detectamos un ${escaparHtml(cambio)} en una entidad que sigues.</p>` +
      `<p><strong>${escaparHtml(entidad)}</strong></p>` +
      `<table role="presentation" style="border-collapse:collapse;">${filasHtml}</table>` +
      `<p><a href="${escaparHtml(enlace)}">Ver el detalle completo en la plataforma</a></p>` +
      `</body></html>`;

    return { asunto, html, texto };
  }
}
