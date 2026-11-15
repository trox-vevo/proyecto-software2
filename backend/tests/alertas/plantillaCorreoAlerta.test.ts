import { describe, expect, it } from "vitest";
import { PlantillaCorreoAlerta, escaparHtml } from "../../src/alertas/application/PlantillaCorreoAlerta";
import type { DatosAlertaCorreo } from "../../src/alertas/domain/EnvioCorreo";

const ENLACE = "https://yupay.test/?alerta=1";

const alertaDeTasa: DatosAlertaCorreo = {
  id: 1,
  entidad: "Banco Andino Demo",
  tipo: "CAMBIO_TASA",
  valorAnterior: "4.50%",
  valorNuevo: "3.80%",
  variacionPct: "-15.56%",
};

const alertaDeRiesgo: DatosAlertaCorreo = {
  id: 2,
  entidad: "Banco Andino Demo",
  tipo: "CAMBIO_RIESGO",
  valorAnterior: "A-",
  valorNuevo: "C",
  variacionPct: null,
};

describe("Plantilla del correo de alerta crítica (US40, TS-124)", () => {
  it("el asunto indica el tipo de cambio y la entidad", () => {
    const contenido = new PlantillaCorreoAlerta().construir(alertaDeTasa, ENLACE);

    expect(contenido.asunto).toBe("Alerta crítica: cambio de tasa en Banco Andino Demo");
  });

  it("una alerta de tasa muestra entidad, valor anterior, valor nuevo, variación y el enlace", () => {
    const { html, texto } = new PlantillaCorreoAlerta().construir(alertaDeTasa, ENLACE);

    for (const contenido of [html, texto]) {
      expect(contenido).toContain("Banco Andino Demo");
      expect(contenido).toContain("4.50%");
      expect(contenido).toContain("3.80%");
      expect(contenido).toContain("-15.56%");
      expect(contenido).toContain(ENLACE);
    }
  });

  it("una alerta de riesgo muestra las calificaciones anterior y nueva", () => {
    const contenido = new PlantillaCorreoAlerta().construir(alertaDeRiesgo, ENLACE);

    expect(contenido.asunto).toBe("Alerta crítica: cambio de riesgo en Banco Andino Demo");
    expect(contenido.texto).toContain("Calificación anterior: A-");
    expect(contenido.texto).toContain("Calificación nueva: C");
    expect(contenido.texto).not.toContain("Tasa anterior");
    expect(contenido.texto).not.toContain("Variación");
  });

  it("si la tasa anterior era 0 no hay variación que mostrar", () => {
    const { texto } = new PlantillaCorreoAlerta().construir({ ...alertaDeTasa, variacionPct: null }, ENLACE);

    expect(texto).toContain("Tasa nueva: 3.80%");
    expect(texto).not.toContain("Variación");
  });

  it("escapa el HTML del nombre de la entidad para que no pueda inyectar etiquetas", () => {
    const { html } = new PlantillaCorreoAlerta().construir(
      { ...alertaDeTasa, entidad: '<script>alert("x")</script>' },
      ENLACE,
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("el asunto queda en una sola línea aunque el nombre de la entidad tenga saltos de línea", () => {
    const { asunto } = new PlantillaCorreoAlerta().construir(
      { ...alertaDeTasa, entidad: "Banco\r\nBcc: otro@ejemplo.com" },
      ENLACE,
    );

    expect(asunto).not.toMatch(/[\r\n]/);
  });

  it("escaparHtml convierte los caracteres especiales", () => {
    expect(escaparHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
});
