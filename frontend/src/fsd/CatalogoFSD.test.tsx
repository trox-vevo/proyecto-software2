import revisionData from "../../../backend/db/fsd-verificacion-2026-11-15.json";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificacionVisual } from "../alertas/NotificacionVisual";
import type { Alerta } from "../alertas/tipos";
import { TablaResultadosPlazoFijo } from "../plazo_fijo/TablaResultadosPlazoFijo";
import type { CoberturaFSD } from "./IndicadorFSD";

const revision = revisionData as {
  consultadoEl: string; revisionLocalHasta: string; fuenteMiembros: string; fuenteSbs: string;
  entidades: { idExistente: number | null; nombre: string; verificadaFsd: boolean }[];
};
const selected = revision.entidades.filter((entry) => entry.idExistente === 1 || entry.idExistente === 5);
const coverage = (entry: typeof selected[number]): CoberturaFSD => ({
  estado: entry.verificadaFsd ? "CUBIERTO" : "NO_VERIFICADO", entidadFinanciera: entry.nombre,
  fechaVerificacion: revision.consultadoEl, vigenteHasta: entry.verificadaFsd ? revision.revisionLocalHasta : null,
  fuente: entry.verificadaFsd ? revision.fuenteMiembros : revision.fuenteSbs,
});
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-15T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("US21 y US35 con la revisión FSD local", () => {
  it("US21 muestra nombres reales, evidencia del banco y advertencia para la cooperativa sin cambiar importes", () => {
    render(<TablaResultadosPlazoFijo modalidad="AT_MATURITY" resultados={selected.map((entry) => ({
      productId: entry.idExistente!, entityName: entry.nombre, coberturaFSD: coverage(entry),
      tea: "0.055", totalInterest: "56.04", monthlyInterest: null, minimumAmount: "500.00", riskRating: null,
    }))} />);
    const bank = screen.getByRole("cell", { name: "Banco de Crédito del Perú (BCP)" }).closest("tr")!;
    const coop = screen.getByRole("cell", { name: "Cooperativa Abaco" }).closest("tr")!;
    expect(within(bank).getByText("Con cobertura FSD")).toBeInTheDocument();
    expect(within(bank).getByRole("link", { name: "Consultar fuente oficial FSD" })).toHaveAttribute("href", revision.fuenteMiembros);
    expect(within(coop).getByText("Cobertura FSD no verificada")).toBeInTheDocument();
    expect(within(coop).getByText(/No implica ausencia de cobertura/)).toBeInTheDocument();
    expect(screen.queryByText("Sin cobertura FSD")).not.toBeInTheDocument();
    expect(within(bank).getByRole("cell", { name: "S/ 56.04" })).toBeInTheDocument();
  });

  function alerts() {
    return <ul>{selected.map((entry): Alerta => ({
      id: entry.idExistente!, entidadId: entry.idExistente!, entidad: entry.nombre, tipo: "TASA",
      tasaAnterior: "5.00%", tasaNueva: "6.00%", variacionPct: "+20.00%", calificacionAnterior: null,
      calificacion: null, coberturaFSD: coverage(entry), leida: false, creadaEn: "2026-11-15T12:00:00Z",
    })).map((alerta) => <NotificacionVisual key={alerta.id} alerta={alerta} seleccionada={false} onAbrir={() => {}} />)}</ul>;
  }

  it("US35 conserva el evento y muestra ambos indicadores con su advertencia", () => {
    render(alerts());
    expect(screen.getByRole("button", { name: /Banco de Crédito/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cooperativa Abaco/ })).toBeInTheDocument();
    expect(screen.getByText("Con cobertura FSD")).toBeInTheDocument();
    expect(screen.getByText("Cobertura FSD no verificada")).toBeInTheDocument();
    expect(screen.getByText(/No implica ausencia de cobertura/)).toBeInTheDocument();
    expect(screen.getAllByText("Tasa: 5.00% → 6.00% (+20.00%)")).toHaveLength(2);
  });

  it("US35 advierte también al vencer la revisión sin afirmar falta de protección", () => {
    vi.setSystemTime(new Date("2026-11-23T00:00:00Z"));
    render(alerts());
    expect(screen.getAllByText("Cobertura FSD no verificada")).toHaveLength(2);
    expect(screen.queryByText("Con cobertura FSD")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin cobertura FSD")).not.toBeInTheDocument();
  });
});
