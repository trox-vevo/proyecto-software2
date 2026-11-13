import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAuthSession } from "../auth/session";
import { TablaResultadosPlazoFijo } from "../plazo_fijo/TablaResultadosPlazoFijo";
import type { ResultadoPlazoFijo } from "../plazo_fijo/tipos";
import { EconomistReportModal } from "./EconomistReportModal";
import type { EconomistReport } from "./tipos";

// US26 (TS-83): la ventana del informe sola y conectada a la tabla de plazo fijo
const informe = (cambios: Partial<EconomistReport> = {}): EconomistReport => ({
  entityId: 1,
  entityName: "Entidad A",
  summary: "Entidad muy sólida.",
  strengths: ["Capital alto", "Morosidad baja"],
  risks: ["Mucha competencia"],
  recommendation: "Opción de bajo riesgo.",
  author: "Área de Estudios Económicos",
  publishedAt: "2026-10-15",
  sbsProfile: {
    entityId: 1,
    entityName: "Entidad A",
    riskRating: "A+",
    capitalAdequacyRatio: "0.1620",
    delinquencyRate: "0.0210",
    liquidityRatio: "0.3150",
    reportDate: "2026-09-30",
    sourceUrl: "https://www.sbs.gob.pe/",
  },
  ...cambios,
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("EconomistReportModal", () => {
  it("cerrada (report en null) no muestra nada", () => {
    render(<EconomistReportModal report={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("muestra todas las secciones del informe", () => {
    render(<EconomistReportModal report={informe()} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Informe del economista: Entidad A" });
    expect(dialog).toHaveTextContent("Área de Estudios Económicos · 15/10/2026");
    for (const titulo of ["Resumen", "Indicadores de la SBS", "Fortalezas", "Riesgos", "Recomendación"]) {
      expect(within(dialog).getByRole("heading", { name: titulo })).toBeInTheDocument();
    }
    expect(dialog).toHaveTextContent("Entidad muy sólida.");
    expect(within(dialog).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Capital alto", "Morosidad baja", "Mucha competencia"]);
    expect(within(dialog).getByRole("region", { name: "Indicadores de riesgo de Entidad A" })).toHaveTextContent("Riesgo bajo");
  });

  it("sin datos de la SBS no muestra la sección de indicadores", () => {
    render(<EconomistReportModal report={informe({ sbsProfile: null })} onClose={vi.fn()} />);
    expect(screen.queryByRole("heading", { name: "Indicadores de la SBS" })).not.toBeInTheDocument();
  });

  it.each([
    ["el botón 'Cerrar'", () => userEvent.click(screen.getByRole("button", { name: "Cerrar" }))],
    ["la tecla Escape", () => userEvent.keyboard("{Escape}")],
  ])("se cierra con %s", async (_, cerrar) => {
    const onClose = vi.fn();
    render(<EconomistReportModal report={informe()} onClose={onClose} />);

    await cerrar();

    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Pop-up del informe desde la tabla de plazo fijo", () => {
  const fila: ResultadoPlazoFijo = {
    productId: 1,
    entityName: "Entidad A",
    tea: "0.055",
    totalInterest: "55.00",
    monthlyInterest: null,
    minimumAmount: "500.00",
    riskRating: "A+",
  };

  it("un usuario Pro hace clic en la calificación, se abre el informe y lo cierra", async () => {
    saveAuthSession({
      id: "sesion-1",
      userId: 2,
      tokenJwt: "token-de-prueba",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      plan: "PRO",
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(informe()), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TablaResultadosPlazoFijo resultados={[fila]} modalidad="AT_MATURITY" />);

    await userEvent.click(screen.getByRole("button", { name: /A\+/ }));

    const dialog = await screen.findByRole("dialog", { name: "Informe del economista: Entidad A" });
    expect(dialog).toHaveTextContent("Opción de bajo riesgo.");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/risk-reports\/1$/);

    await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
