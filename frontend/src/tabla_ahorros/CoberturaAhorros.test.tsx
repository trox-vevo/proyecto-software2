import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import associations from "../../../backend/db/savings-entity-associations.json";
import revision from "../../../backend/db/fsd-verificacion-2026-11-15.json";
import { COLUMNAS } from "./columnas";
import { TablaAhorrosView } from "./TablaAhorrosView";
import type { FilaConRiesgo } from "../semaforo/tipos";

const rows: FilaConRiesgo[] = associations.map((association) => ({
  cuentaId: association.accountId, entityId: association.entityId, entityName: association.entityName,
  capitalInicial: "1,000.00", interesGenerado: "50.00", saldoFinal: "1,050.00", fechaApertura: "10/01/2023",
  monthlyMaintenanceFee: "0.00", channels: { hasPhysicalBranches: true, hasAtms: true }, riesgo: null,
  coberturaFSD: { entidadFinanciera: association.entityName, estado: association.entityId <= 4 ? "CUBIERTO" : "NO_VERIFICADO",
    fechaVerificacion: revision.consultadoEl, vigenteHasta: association.entityId <= 4 ? revision.revisionLocalHasta : null,
    fuente: association.entityId <= 4 ? revision.fuenteMiembros : revision.fuenteSbs },
}));
const renderTable = (filas = rows, onConsultarTermino = vi.fn()) => render(<TablaAhorrosView
  columnas={COLUMNAS} filas={filas} estado="CON_DATOS" criterioActivo="RENTABILIDAD"
  onOrdenar={() => {}} onReintentar={() => {}} onConsultarTermino={onConsultarTermino} />);
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-16T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("US21: entidades y estado FSD en ahorros", () => {
  it("muestra las seis identidades y estados concisos junto a los importes originales", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: "Entidad financiera" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("FSD: Verificado")).toHaveLength(4);
    expect(screen.getAllByLabelText("FSD: No verificado")).toHaveLength(2);
    expect(screen.queryByText("No cubierto")).not.toBeInTheDocument();
    for (const association of associations) {
      const row = screen.getByRole("cell", { name: association.accountId }).closest("tr")!;
      expect(within(row).getByRole("cell", { name: association.entityName })).toBeInTheDocument();
      expect(within(row).getByRole("cell", { name: "1,050.00" })).toBeInTheDocument();
    }
    expect(screen.queryByText(/académic|demostración|ficticios/i)).not.toBeInTheDocument();
  });

  it("conserva la fuente, el acceso contextual al glosario y las limitaciones financieras", async () => {
    const consultar = vi.fn();
    renderTable(rows, consultar);
    expect(screen.getByRole("link", { name: /Consultar fuente FSD de Banco de Crédito/ })).toHaveAttribute("href", revision.fuenteMiembros);
    expect(screen.getAllByRole("tooltip").some((tooltip) => tooltip.textContent?.includes("FSDC"))).toBe(true);
    expect(screen.getAllByRole("tooltip").some((tooltip) => tooltip.textContent?.includes("límites y condiciones"))).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Consultar FSD" }));
    expect(consultar).toHaveBeenCalledWith("FSD");
  });

  it("la evidencia vencida o sin fuente se indica como no verificada sin cambiar la entidad", () => {
    vi.setSystemTime(new Date("2026-12-16T00:00:00Z"));
    const view = renderTable();
    expect(screen.getAllByLabelText("FSD: No verificado")).toHaveLength(6);
    view.unmount();
    vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
    renderTable([{ ...rows[0], coberturaFSD: { ...rows[0].coberturaFSD!, fuente: null } }]);
    expect(screen.getByLabelText("FSD: No verificado")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Banco de Crédito del Perú (BCP)" })).toBeInTheDocument();
  });
});
