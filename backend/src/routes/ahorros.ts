import { Router } from "express";
import { CriterioOrden } from "../rentabilidad/CriterioOrden";
import { FiltroAhorros } from "../rentabilidad/FiltroAhorros";
import { FormateadorResultados } from "../rentabilidad/FormateadorResultados";
import { MotorCalculo } from "../rentabilidad/MotorCalculo";
import { RentabilidadCompuesta } from "../rentabilidad/RentabilidadCompuesta";
import { RentabilidadSimple } from "../rentabilidad/RentabilidadSimple";
import { RepositorioCuentas } from "../repositorio/RepositorioCuentas";
import type { CuentaAhorros } from "../rentabilidad/CuentaAhorros";
import { conCapital } from "../rentabilidad/conCapital";
import type { ResultadoFormateado } from "../rentabilidad/ResultadoFormateado";
import { riskLevelFromRating } from "../risk/domain/riskLevelFromRating";
import type { SbsRiskRepository } from "../risk/domain/SbsRiskRepository";

/** Cualquier origen de cuentas: el JSON (pruebas) o la base de datos (index.ts). */
export interface FuenteCuentas {
  obtenerTodas(): CuentaAhorros[];
}

/** Un parámetro de la URL, o undefined si no vino (o vino vacío). */
function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

function leerCriterio(valor: string | undefined): CriterioOrden {
  if (valor === undefined) return CriterioOrden.RENTABILIDAD;
  const validos = Object.values(CriterioOrden) as string[];
  if (!validos.includes(valor)) {
    throw new RangeError(`criterio inválido. Usa uno de: ${validos.join(", ")}`);
  }
  return valor as CriterioOrden;
}

function leerAlgoritmo(valor: string | undefined) {
  if (valor === undefined || valor === "simple") return new RentabilidadSimple();
  if (valor === "compuesta") return new RentabilidadCompuesta();
  throw new RangeError("algoritmo inválido. Usa: simple o compuesta");
}

function leerMonto(valor: string | undefined, nombre: string): string | undefined {
  if (valor === undefined) return undefined;
  if (!/^\d+(\.\d+)?$/.test(valor)) throw new RangeError(`${nombre} debe ser un número positivo`);
  return valor;
}

/** US08: monto del usuario, igual que en plazo fijo: positivo y con máximo 2 decimales. */
function leerMontoUsuario(valor: string | undefined): string | undefined {
  if (valor === undefined) return undefined;
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(valor) || Number(valor) <= 0) {
    throw new RangeError("monto debe ser un número mayor que 0 con máximo 2 decimales");
  }
  return valor;
}

function leerDepartamento(valor: string | undefined): string | undefined {
  if (valor === undefined) return undefined;
  const departamento = valor.trim();
  if (!departamento || departamento.length > 80) throw new RangeError("departamento inválido");
  return departamento;
}

function leerFecha(valor: string | undefined, nombre: string): Date | undefined {
  if (valor === undefined) return undefined;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new RangeError(`${nombre} debe tener formato AAAA-MM-DD`);
  return fecha;
}

/**
 * GET /api/ahorros/rentabilidad
 * Parámetros (todos opcionales):
 *   dias=365  criterio=RENTABILIDAD|SALDO|FECHA  algoritmo=simple|compuesta
 *   saldoMinimo=500  saldoMaximo=5000  desde=2023-01-01  hasta=2024-12-31
 *   monto=1500.50  departamento=Lima   (US08/US09/US13: búsqueda del formulario)
 * Con monto, cada cuenta se simula con ese capital y se excluyen las de monto mínimo mayor.
 * Con departamento, solo se devuelven las cuentas ofrecidas ahí. Sin ellos, igual que antes.
 * Cada fila agrega tasaAnual, montoMinimo y, si hay repositorio SBS, riesgo (US22/US23).
 */
export function createAhorrosRouter(
  repositorio: FuenteCuentas = new RepositorioCuentas(),
  sbsRiskRepository?: SbsRiskRepository,
): Router {
  /** Solo el color del semáforo: la calificación (letra) sigue siendo exclusiva de Pro (US27). */
  function riesgoDe(cuenta: CuentaAhorros | undefined) {
    if (cuenta?.entityId == null || !sbsRiskRepository) return null;
    const perfil = sbsRiskRepository.findByEntityId(cuenta.entityId);
    const nivel = perfil ? riskLevelFromRating(perfil.riskRating) : null;
    return nivel ? { nivel } : null;
  }

  function enriquecer(fila: ResultadoFormateado, porId: Map<string, CuentaAhorros>) {
    const cuenta = porId.get(fila.cuentaId);
    return {
      ...fila,
      tasaAnual: cuenta?.tasaAnual.toString() ?? null,
      montoMinimo: cuenta?.montoMinimo.toFixed(2) ?? null,
      ...(sbsRiskRepository ? { riesgo: riesgoDe(cuenta) } : {}),
    };
  }

  const ahorrosRouter = Router();
  ahorrosRouter.get("/rentabilidad", (req, res) => {
    try {
      const dias = Number(texto(req.query.dias) ?? 365);
      const accountId = texto(req.query.accountId);
      if (accountId !== undefined && !accountId.trim()) throw new RangeError("accountId debe identificar una cuenta");
      const criterio = leerCriterio(texto(req.query.criterio));
      const monto = leerMontoUsuario(texto(req.query.monto));
      const algoritmo = leerAlgoritmo(texto(req.query.algoritmo));
      const filtro = new FiltroAhorros({
        saldoMinimo: leerMonto(texto(req.query.saldoMinimo), "saldoMinimo"),
        saldoMaximo: leerMonto(texto(req.query.saldoMaximo), "saldoMaximo"),
        desde: leerFecha(texto(req.query.desde), "desde"),
        hasta: leerFecha(texto(req.query.hasta), "hasta"),
        departamento: leerDepartamento(texto(req.query.departamento)),
        montoDisponible: monto,
      });
  
      const motor = new MotorCalculo(algoritmo, filtro, new FormateadorResultados());
      const cuentas = repositorio.obtenerTodas();
      const porCuenta = accountId === undefined
        ? cuentas
        : cuentas.filter((cuenta) => cuenta.id === accountId);
      const seleccionadas = monto === undefined ? porCuenta : porCuenta.map((cuenta) => conCapital(cuenta, monto));
      const porId = new Map(seleccionadas.map((cuenta) => [cuenta.id, cuenta]));
      const resultados = motor.calcular(seleccionadas, dias, criterio).map((fila) => enriquecer(fila, porId));

      res.json({ resultados });
    } catch (error) {
      if (error instanceof RangeError) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error(error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });
  return ahorrosRouter;
}

// Compatibilidad: el router por defecto sigue leyendo data/cuentas.json
export const ahorrosRouter = createAhorrosRouter();
