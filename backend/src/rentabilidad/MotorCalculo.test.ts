import { describe, expect, it } from "vitest";
import { CriterioOrden } from "./CriterioOrden";
import { Decimal } from "decimal.js";
import { CuentaAhorros } from "./CuentaAhorros";
import { FiltroAhorros } from "./FiltroAhorros";
import { FormateadorResultados } from "./FormateadorResultados";
import { MotorCalculo } from "./MotorCalculo";
import { RentabilidadCompuesta } from "./RentabilidadCompuesta";
import { RentabilidadSimple } from "./RentabilidadSimple";
import type { ResultadoFormateado } from "./ResultadoFormateado";
import { DigitalChannels } from "../simulation/domain/DigitalChannels";
import { ServiceChannels } from "../simulation/domain/ServiceChannels";

// Tres cuentas de prueba, con saldos, tasas y fechas distintos
const cuentaA = new CuentaAhorros("A", "Ana", 1000, 0.05, new Date("2023-01-10"), 0, new ServiceChannels(true, true), undefined, new DigitalChannels(true, true));
const cuentaB = new CuentaAhorros("B", "Beto", 5000, 0.02, new Date("2022-06-01"), 5, new ServiceChannels(true, false), undefined, new DigitalChannels(true, true));
const cuentaC = new CuentaAhorros("C", "Carla", 300, 0.1, new Date("2024-03-15"), 8.5, new ServiceChannels(false, true), undefined, new DigitalChannels(true, true));
const cuentas = [cuentaA, cuentaB, cuentaC];

function crearMotor(filtro = new FiltroAhorros()) {
  return new MotorCalculo(new RentabilidadSimple(), filtro, new FormateadorResultados());
}

/** "Cuenta A | Capital: ..." -> "A" */
function ids(salida: ResultadoFormateado[]): string[] {
  return salida.map((resultado) => resultado.cuentaId);
}

describe("MotorCalculoTest", () => {
  it("testRentSimple: interés simple", () => {
    const algoritmo = new RentabilidadSimple();
    expect(algoritmo.calcular(cuentaA, 365).toString()).toBe("50");
    expect(algoritmo.calcular(cuentaA, 730).toString()).toBe("100");
    // 1000 × 0.05 × 180 / 365 = 24.6575... -> 24.66
    expect(algoritmo.calcular(cuentaA, 180).toString()).toBe("24.66");
  });

  it("testRentComp: interés compuesto", () => {
    const algoritmo = new RentabilidadCompuesta();
    expect(algoritmo.calcular(cuentaA, 365).toString()).toBe("50");
    // 1000 × (1.05² − 1) = 102.50
    expect(algoritmo.calcular(cuentaA, 730).toString()).toBe("102.5");
  });

  it("testRentComp: el compuesto supera al simple cuando pasa más de un año", () => {
    const simple = new RentabilidadSimple().calcular(cuentaA, 730);
    const compuesto = new RentabilidadCompuesta().calcular(cuentaA, 730);
    expect(compuesto.gt(simple)).toBe(true);
  });

  it("testFiltros: por saldo y por fecha", () => {
    const porSaldo = new FiltroAhorros({ saldoMinimo: 500 }).aplicar(cuentas);
    expect(porSaldo.map((c) => c.id)).toEqual(["A", "B"]);

    const porRango = new FiltroAhorros({ saldoMinimo: 200, saldoMaximo: 1000 }).aplicar(cuentas);
    expect(porRango.map((c) => c.id)).toEqual(["A", "C"]);

    const porFecha = new FiltroAhorros({ desde: new Date("2023-01-01") }).aplicar(cuentas);
    expect(porFecha.map((c) => c.id)).toEqual(["A", "C"]);

    expect(new FiltroAhorros().aplicar(cuentas)).toHaveLength(3);
  });

  it("testOrden: por rentabilidad, saldo y fecha", () => {
    const motor = crearMotor();
    // 365 días, interés simple: A = 50, B = 100, C = 30
    expect(ids(motor.calcular(cuentas, 365, CriterioOrden.RENTABILIDAD))).toEqual(["B", "A", "C"]);
    // Saldo final: A = 1050, B = 5100, C = 330
    expect(ids(motor.calcular(cuentas, 365, CriterioOrden.SALDO))).toEqual(["B", "A", "C"]);
    // Fecha de apertura, la más reciente primero
    expect(ids(motor.calcular(cuentas, 365, CriterioOrden.FECHA))).toEqual(["C", "A", "B"]);
  });

  it("testOrden: ordena por el valor numérico, no por el texto", () => {
    const motor = crearMotor();
    const a = new CuentaAhorros("X", "x", 900, 0, new Date("2024-01-01"), 0, new ServiceChannels(true, true), undefined, new DigitalChannels(true, true)); // saldo final 900
    const b = new CuentaAhorros("Y", "y", 2000, 0, new Date("2024-01-01"), 0, new ServiceChannels(true, true), undefined, new DigitalChannels(true, true)); // saldo final 2000
    const c = new CuentaAhorros("Z", "z", 1250.5, 0, new Date("2024-01-01"), 0, new ServiceChannels(true, true), undefined, new DigitalChannels(true, true)); // saldo final 1250.50
    expect(ids(motor.calcular([a, b, c], 30, CriterioOrden.SALDO))).toEqual(["Y", "Z", "X"]);
  });

  it("formatea los montos con miles, dos decimales y fecha dd/mm/aaaa", () => {
    const salida = crearMotor().calcular([cuentaB], 365, CriterioOrden.SALDO);
     expect(salida).toEqual([
      {
        cuentaId: "B",
        entidad: "Beto",
        tasaAnual: "0.02",
        montoMinimo: null,
        coberturaFSD: { entidadFinanciera: null, estado: "NO_VERIFICADO", fechaVerificacion: null, vigenteHasta: null, fuente: null },
        capitalInicial: "5,000.00",
        interesGenerado: "100.00",
        saldoFinal: "5,100.00",
        fechaApertura: "01/06/2022",
        monthlyMaintenanceFee: "5.00",
        channels: { hasPhysicalBranches: true, hasAtms: false },
        digitalChannels: { hasDigitalBanking: true, hasMobileApp: true },
      },
    ]);
  });

  it("aplica el filtro dentro del motor", () => {
    const motor = crearMotor(new FiltroAhorros({ saldoMinimo: 500 }));
    expect(ids(motor.calcular(cuentas, 365, CriterioOrden.SALDO))).toEqual(["B", "A"]);
  });

  it("setAlgoritmo cambia la fórmula sin tocar el motor", () => {
    const motor = crearMotor();
    const simple = motor.calcular([cuentaA], 730, CriterioOrden.SALDO)[0];
    motor.setAlgoritmo(new RentabilidadCompuesta());
    const compuesto = motor.calcular([cuentaA], 730, CriterioOrden.SALDO)[0];
    expect(simple.interesGenerado).toBe("100.00");
    expect(compuesto.interesGenerado).toBe("102.50");
  });

  it("rechaza un número de días inválido", () => {
    const motor = crearMotor();
    expect(() => motor.calcular(cuentas, 0, CriterioOrden.SALDO)).toThrow(RangeError);
    expect(() => motor.calcular(cuentas, -5, CriterioOrden.SALDO)).toThrow(RangeError);
    expect(() => motor.calcular(cuentas, 1.5, CriterioOrden.SALDO)).toThrow(RangeError);
  });

  it("US17/US18: cada resultado trae la comisión (2 decimales) y los canales de su cuenta", () => {
    const [resultado] = crearMotor().calcular([cuentaC], 365, CriterioOrden.SALDO);
    expect(resultado.monthlyMaintenanceFee).toBe("8.50");
    expect(resultado.channels).toEqual({ hasPhysicalBranches: false, hasAtms: true });
  });
});

// US09/US11: búsqueda por monto y departamento. Cada prueba arma sus propios productos (no usa el seed).
function producto(id: string, entidad: string, tasa: string, departamento: string, montoMinimo: string, saldo = "300") {
  return new CuentaAhorros(id, `Titular ${id}`, saldo, tasa, new Date("2024-01-01"), "0", new ServiceChannels(true, true),
    undefined, new DigitalChannels(true, true), { entidad, departamento, montoMinimo: new Decimal(montoMinimo) });
}
const productos = [
  producto("AH-001", "BCP", "0.05", "Lima", "0.00"),
  producto("AH-002", "BBVA", "0.02", "Lima", "0.00"),
  producto("AH-003", "Interbank", "0.1", "Lima", "1000.00"),
  producto("AH-004", "Scotiabank", "0.035", "Lima", "0.00"),
  producto("AH-005", "Abaco", "0.045", "Lima", "500.00"),
  producto("AH-006", "Pacífico", "0.03", "Cusco", "0.00"),
];

function buscar(monto: string, departamento: string, cuentasEntrada = productos) {
  const motor = crearMotor(new FiltroAhorros({ departamento, montoInvertido: monto }));
  return motor.calcular(cuentasEntrada, 365, CriterioOrden.RENTABILIDAD, new Decimal(monto));
}
const interes = (salida: ResultadoFormateado[]) => salida.map((r) => [r.cuentaId, r.interesGenerado]);

describe("US09: búsqueda por monto y departamento", () => {
  it("Lima, monto 1000: calcula sobre el monto y ordena de mayor a menor ganancia", () => {
    expect(interes(buscar("1000", "Lima"))).toEqual([
      ["AH-003", "100.00"], ["AH-001", "50.00"], ["AH-005", "45.00"], ["AH-004", "35.00"], ["AH-002", "20.00"],
    ]);
  });

  it("Lima, monto 800: excluye el producto con monto mínimo 1000", () => {
    expect(interes(buscar("800", "Lima"))).toEqual([
      ["AH-001", "40.00"], ["AH-005", "36.00"], ["AH-004", "28.00"], ["AH-002", "16.00"],
    ]);
  });

  it("Lima, monto 500: incluye el producto cuyo mínimo es igual al monto", () => {
    const salida = buscar("500", "Lima");
    expect(salida.find((r) => r.cuentaId === "AH-005")?.interesGenerado).toBe("22.50");
    expect(ids(salida)).not.toContain("AH-003");
  });

  it("Cusco, monto 1000: solo el producto de Cusco", () => {
    expect(interes(buscar("1000", "Cusco"))).toEqual([["AH-006", "30.00"]]);
  });

  it("Arequipa: ninguna entidad coincide -> []", () => {
    expect(buscar("1000", "Arequipa")).toEqual([]);
  });

  it("compara el departamento sin mayúsculas ni espacios exteriores", () => {
    expect(buscar("1000", "  lima  ")).toEqual(buscar("1000", "Lima"));
  });

  it("capitalInicial es el monto ingresado y trae entidad, tasa y monto mínimo", () => {
    const salida = buscar("1000", "Lima");
    for (const resultado of salida) expect(resultado.capitalInicial).toBe("1,000.00");
    expect(salida[0]).toMatchObject({ entidad: "Interbank", tasaAnual: "0.1", montoMinimo: "1,000.00", saldoFinal: "1,100.00" });
  });

  it("no modifica el saldo de las cuentas originales", () => {
    buscar("1000", "Lima");
    expect(productos[0].saldo.toString()).toBe("300");
  });

  it("una cuenta sin producto queda excluida al filtrar por departamento o monto", () => {
    expect(new FiltroAhorros({ departamento: "Lima" }).aplicar([cuentaA])).toEqual([]);
    expect(new FiltroAhorros({ montoInvertido: 1000 }).aplicar([cuentaA])).toEqual([]);
  });

  it("sin monto ni departamento: mismo resultado que antes (calcula sobre el saldo)", () => {
    const salida = crearMotor().calcular(cuentas, 365, CriterioOrden.RENTABILIDAD);
    expect(interes(salida)).toEqual([["B", "100.00"], ["A", "50.00"], ["C", "30.00"]]);
    expect(salida.map((r) => r.capitalInicial)).toEqual(["5,000.00", "1,000.00", "300.00"]);
    expect(salida.map((r) => [r.entidad, r.montoMinimo])).toEqual([["Beto", null], ["Ana", null], ["Carla", null]]);
  });

  it("conCapital devuelve una cuenta nueva con el resto de datos iguales", () => {
    const copia = productos[2].conCapital(new Decimal("2500"));
    expect(copia).not.toBe(productos[2]);
    expect(copia.saldo.toString()).toBe("2500");
    expect(copia.producto).toBe(productos[2].producto);
    expect(copia.tasaAnual.toString()).toBe("0.1");
  });
});
