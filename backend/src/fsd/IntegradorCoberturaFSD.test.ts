
import { describe, expect, it } from "vitest";
import { agregarCoberturaFSD } from "./IntegradorCoberturaFSD";

describe("US21 - Integración de cobertura FSD", () => {
  it("agrega la cobertura a una cuenta", () => {
    const cuentas = [
      {
        cuentaId: "AH-001",
        saldoFinal: "1,050.00"
      }
    ];

    const resultado = agregarCoberturaFSD(cuentas);

    expect(resultado[0].coberturaFSD.estado).toBe("NO_VERIFICADO");
    expect(resultado[0].coberturaFSD.entidadFinanciera).toBeNull();
    expect(resultado[0].saldoFinal).toBe("1,050.00");
  });

  it("conserva todas las cuentas originales", () => {
    const cuentas = [
      { cuentaId: "AH-001" },
      { cuentaId: "AH-002" }
    ];

    const resultado = agregarCoberturaFSD(cuentas);

    expect(resultado).toHaveLength(2);
    expect(resultado[0].cuentaId).toBe("AH-001");
    expect(resultado[1].cuentaId).toBe("AH-002");
  });
});
