import { describe, expect, it } from "vitest";
import {
  applyFilters,
  hasAtmsFilter,
  hasPhysicalBranchesFilter,
  noMaintenanceFeeFilter,
  type SimulationResultDto,
} from "./resultFilters";

// Datos propios de la prueba: entidades A–F de la tabla de CLAUDE.md §7
const result = (id: string, monthlyMaintenanceFee: string | undefined, hasPhysicalBranches: boolean, hasAtms: boolean) => ({
  id,
  monthlyMaintenanceFee,
  channels: { hasPhysicalBranches, hasAtms },
});
const A = result("A", "0.00", true, true);
const B = result("B", "0.00", true, false);
const C = result("C", "5.00", false, true);
const D = result("D", "0.00", false, false);
const E = result("E", "8.50", true, true);
const F = result("F", "3.00", true, false);
const lima = [A, B, C, D, E];

const ids = (results: { id: string }[]) => results.map((r) => r.id);

describe("applyFilters (US17/US18): tabla de casos de CLAUDE.md §7", () => {
  it.each([
    { filters: [], expected: ["A", "B", "C", "D", "E"], caso: "ninguno" },
    { filters: [noMaintenanceFeeFilter], expected: ["A", "B", "D"], caso: "sin costo" },
    { filters: [hasPhysicalBranchesFilter], expected: ["A", "B", "E"], caso: "agencias" },
    { filters: [hasAtmsFilter], expected: ["A", "C", "E"], caso: "cajeros" },
    { filters: [hasPhysicalBranchesFilter, hasAtmsFilter], expected: ["A", "E"], caso: "agencias + cajeros (AND)" },
    {
      filters: [noMaintenanceFeeFilter, hasPhysicalBranchesFilter, hasAtmsFilter],
      expected: ["A"],
      caso: "sin costo + agencias + cajeros",
    },
  ])("Lima, $caso → $expected", ({ filters, expected }) => {
    expect(ids(applyFilters(lima, filters))).toEqual(expected);
  });

  it("Cusco (solo F) con 'Sin costo' → [] (zero-state)", () => {
    expect(applyFilters([F], [noMaintenanceFeeFilter])).toEqual([]);
  });

  it("no modifica la lista original", () => {
    const copy = [...lima];
    applyFilters(lima, [noMaintenanceFeeFilter]);
    expect(lima).toEqual(copy);
  });
});

describe("noMaintenanceFeeFilter (US17)", () => {
  it.each(["0", "0.0", "0.00"])("'%s' cuenta como sin costo", (fee) => {
    expect(noMaintenanceFeeFilter.apply(result("X", fee, false, false))).toBe(true);
  });

  it("un resultado sin monthlyMaintenanceFee (plazo fijo) no pasa", () => {
    const fixedDeposit: SimulationResultDto = { channels: { hasPhysicalBranches: true, hasAtms: true } };
    expect(noMaintenanceFeeFilter.apply(fixedDeposit)).toBe(false);
  });

  it("solo aplica a cuentas de ahorro", () => {
    expect(noMaintenanceFeeFilter.appliesTo).toEqual(["SAVINGS"]);
  });
});

describe("filtros de acceso físico (US18)", () => {
  it.each([hasPhysicalBranchesFilter, hasAtmsFilter])("$label aplica a ambos instrumentos", (filter) => {
    expect(filter.appliesTo).toEqual(["SAVINGS", "FIXED_DEPOSIT"]);
  });
});
