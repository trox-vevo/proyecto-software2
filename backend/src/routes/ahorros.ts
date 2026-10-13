import { Router } from "express";
import { CriterioOrden } from "../rentabilidad/CriterioOrden";
import { FiltroAhorros } from "../rentabilidad/FiltroAhorros";
import { FormateadorResultados } from "../rentabilidad/FormateadorResultados";
import { MotorCalculo } from "../rentabilidad/MotorCalculo";
import { RentabilidadCompuesta } from "../rentabilidad/RentabilidadCompuesta";
import { RentabilidadSimple } from "../rentabilidad/RentabilidadSimple";
import { RepositorioCuentas } from "../repositorio/RepositorioCuentas";

export const ahorrosRouter = Router();
const repositorio = new RepositorioCuentas();

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
 */
ahorrosRouter.get("/rentabilidad", (req, res) => {
  try {
    const dias = Number(texto(req.query.dias) ?? 365);
    const criterio = leerCriterio(texto(req.query.criterio));
    const algoritmo = leerAlgoritmo(texto(req.query.algoritmo));
    const filtro = new FiltroAhorros({
      saldoMinimo: leerMonto(texto(req.query.saldoMinimo), "saldoMinimo"),
      saldoMaximo: leerMonto(texto(req.query.saldoMaximo), "saldoMaximo"),
      desde: leerFecha(texto(req.query.desde), "desde"),
      hasta: leerFecha(texto(req.query.hasta), "hasta"),
    });

    const motor = new MotorCalculo(algoritmo, filtro, new FormateadorResultados());
    const resultados = motor.calcular(repositorio.obtenerTodas(), dias, criterio);

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
