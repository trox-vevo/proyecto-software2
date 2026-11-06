import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hasAtmsFilter, hasPhysicalBranchesFilter, noMaintenanceFeeFilter, type InstrumentType } from "./resultFilters";
import { useResultFilters } from "./useResultFilters";

const renderFilters = (instrument: InstrumentType) =>
  renderHook(({ instrument }) => useResultFilters(instrument), { initialProps: { instrument } });

describe("useResultFilters", () => {
  it("en ahorros ofrece los 3 filtros; en plazo fijo, solo los de acceso físico", () => {
    const { result, rerender } = renderFilters("SAVINGS");
    expect(result.current.available).toEqual([noMaintenanceFeeFilter, hasPhysicalBranchesFilter, hasAtmsFilter]);

    rerender({ instrument: "FIXED_DEPOSIT" });
    expect(result.current.available).toEqual([hasPhysicalBranchesFilter, hasAtmsFilter]);
  });

  it("toggle activa y desactiva un filtro", () => {
    const { result } = renderFilters("SAVINGS");

    act(() => result.current.toggle(hasAtmsFilter));
    expect(result.current.active).toEqual([hasAtmsFilter]);

    act(() => result.current.toggle(hasAtmsFilter));
    expect(result.current.active).toEqual([]);
  });

  it("al pasar a plazo fijo, 'Sin costo' se DESACTIVA (no solo se oculta); los de acceso físico siguen", () => {
    const { result, rerender } = renderFilters("SAVINGS");
    act(() => result.current.toggle(noMaintenanceFeeFilter));
    act(() => result.current.toggle(hasPhysicalBranchesFilter));

    rerender({ instrument: "FIXED_DEPOSIT" });
    expect(result.current.active).toEqual([hasPhysicalBranchesFilter]);

    // Al volver a ahorros no reaparece activo
    rerender({ instrument: "SAVINGS" });
    expect(result.current.active).toEqual([hasPhysicalBranchesFilter]);
  });
});
