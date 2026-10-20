import { describe, expect, it } from "vitest";
import type { ParametrosPlazoFijo } from "./tipos";
import { MENSAJE_MONTO_MINIMO, validarParametros } from "./validacion";

const base: Omit<ParametrosPlazoFijo, "amount"> = {
  department: "Lima", paymentMode: "AT_MATURITY", termDays: 360,
};

describe("validarParametros · US07 (TS-24)", () => {
  it("usa el texto exacto de la historia", () => {
    expect(MENSAJE_MONTO_MINIMO).toBe("El monto mínimo requerido para apertura una cuenta es de S/ 500.00");
  });

  it.each(["500", "500.00", "500.01", "1000.50"])("acepta el monto %j", (amount) => {
    expect(validarParametros({ ...base, amount })).toEqual([]);
  });

  it.each(["499.99", "0", "", "  ", "abc", "-1", "-500"])("bloquea el monto %j", (amount) => {
    expect(validarParametros({ ...base, amount })).toEqual([MENSAJE_MONTO_MINIMO]);
  });
});
