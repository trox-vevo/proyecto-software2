import { describe, expect, it } from "vitest";
import {
  applyFilters,
  hasDigitalBankingFilter,
  hasMobileAppFilter,
  hasPhysicalBranchesFilter,
  noMaintenanceFeeFilter,
} from "./resultFilters";

// Datos propios de la prueba: una entidad por cada combinación de banca digital y app móvil
const result = (id: string, hasDigitalBanking: boolean, hasMobileApp: boolean, monthlyMaintenanceFee = "0.00") => ({
  id,
  monthlyMaintenanceFee,
  channels: { hasPhysicalBranches: true, hasAtms: true },
  digitalChannels: { hasDigitalBanking, hasMobileApp },
});
const AMBOS = result("AMBOS", true, true);
const SOLO_BANCA = result("SOLO_BANCA", true, false, "5.00");
const SOLO_APP = result("SOLO_APP", false, true);
const NINGUNO = result("NINGUNO", false, false);
const todos = [AMBOS, SOLO_BANCA, SOLO_APP, NINGUNO];

const ids = (results: { id: string }[]) => results.map((r) => r.id);

describe("filtros de accesibilidad digital (US19)", () => {
  it.each([
    { filters: [hasDigitalBankingFilter], expected: ["AMBOS", "SOLO_BANCA"], caso: "banca digital" },
    { filters: [hasMobileAppFilter], expected: ["AMBOS", "SOLO_APP"], caso: "app móvil" },
    { filters: [hasDigitalBankingFilter, hasMobileAppFilter], expected: ["AMBOS"], caso: "banca + app (AND)" },
    { filters: [hasDigitalBankingFilter, noMaintenanceFeeFilter], expected: ["AMBOS"], caso: "banca + sin costo (US17)" },
  ])("$caso → $expected", ({ filters, expected }) => {
    expect(ids(applyFilters(todos, filters))).toEqual(expected);
  });

  it("si ninguna entidad tiene el canal, el resultado es [] (zero-state)", () => {
    expect(applyFilters([NINGUNO], [hasMobileAppFilter])).toEqual([]);
  });

  it("se combinan con los filtros de acceso físico (US18)", () => {
    const sinAgencias = { ...AMBOS, id: "SIN_AGENCIAS", channels: { hasPhysicalBranches: false, hasAtms: true } };
    expect(ids(applyFilters([AMBOS, sinAgencias], [hasDigitalBankingFilter, hasPhysicalBranchesFilter]))).toEqual([
      "AMBOS",
    ]);
  });

  it.each([hasDigitalBankingFilter, hasMobileAppFilter])("$label aplica a ambos instrumentos", (filter) => {
    expect(filter.appliesTo).toEqual(["SAVINGS", "FIXED_DEPOSIT"]);
  });

  it("usan los textos de la historia", () => {
    expect(hasDigitalBankingFilter.label).toBe("Solo con banca digital");
    expect(hasMobileAppFilter.label).toBe("Con app móvil");
  });
});
