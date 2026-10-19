
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TablaAhorrosView } from "./TablaAhorrosView";
import { COLUMNAS } from "./columnas";
import type { FilaAhorro } from "./tipos";

afterEach(() => {
  cleanup();
});

const filas: FilaAhorro[] = [
  {
    cuentaId: "AH-001",
    capitalInicial: "1,000.00",
    interesGenerado: "50.00",
    saldoFinal: "1,050.00",
    fechaApertura: "10/01/2023",
    coberturaFSD: "? No verificada"
  },
  {
    cuentaId: "AH-002",
    capitalInicial: "5,000.00",
    interesGenerado: "100.00",
    saldoFinal: "5,100.00",
    fechaApertura: "01/06/2022",
    coberturaFSD: "Sin datos FSD"
  }
];

function mostrarTabla(datos: FilaAhorro[] = filas) {
  return render(
    <TablaAhorrosView
      columnas={COLUMNAS}
      filas={datos}
      estado="CON_DATOS"
      criterioActivo="RENTABILIDAD"
      onOrdenar={vi.fn()}
      onReintentar={vi.fn()}
    />
  );
}

describe("US21 - Indicador de cobertura FSD", () => {
  it("muestra la columna de cobertura FSD", () => {
    mostrarTabla();

    expect(
      screen.getByRole("columnheader", { name: "Cobertura FSD" })
    ).toBeTruthy();
  });

  it("muestra el estado no verificado", () => {
    mostrarTabla();

    expect(
      screen.getByText("? No verificada")
    ).toBeTruthy();
  });

  it("muestra un mensaje cuando no hay datos FSD", () => {
    mostrarTabla();

    expect(
      screen.getByText("Sin datos FSD")
    ).toBeTruthy();
  });

  it("conserva los datos originales de las cuentas", () => {
    mostrarTabla();

    expect(screen.getByText("AH-001")).toBeTruthy();
    expect(screen.getByText("AH-002")).toBeTruthy();
    expect(screen.getByText("1,050.00")).toBeTruthy();
  });
});
