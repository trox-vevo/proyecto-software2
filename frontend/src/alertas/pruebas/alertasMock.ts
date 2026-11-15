import type { CoberturaFSD } from "../../fsd/IndicadorFSD";
import type { Alerta } from "../tipos";

/**
 * Datos de PRUEBA con la misma forma que devuelve GET /api/alertas. Solo los usan las pruebas:
 * la aplicación carga las alertas reales desde la API (useAlertas). Las entidades son ficticias
 * y no representan cobertura real.
 *
 * Cubre: alerta de tasa y de riesgo, las tres coberturas FSD, una alerta sin calificación de la SBS
 * y alertas leídas y no leídas (4 pendientes). Una alerta de tasa no trae calificación anterior ni
 * una de riesgo trae tasas, igual que en la API.
 */

// Evidencia que IndicadorFSD acepta como vigente: fuente https de un dominio permitido y fechas válidas.
const FUENTE = "https://fsd.org.pe/";

function cubierta(entidad: string): CoberturaFSD {
  return { estado: "CUBIERTO", entidadFinanciera: entidad, fechaVerificacion: "2026-01-15", vigenteHasta: "2099-12-31", fuente: FUENTE };
}

function noCubierta(entidad: string): CoberturaFSD {
  return { estado: "NO_CUBIERTO", entidadFinanciera: entidad, fechaVerificacion: "2026-01-15", vigenteHasta: "2099-12-31", fuente: FUENTE };
}

const NO_VERIFICADA: CoberturaFSD = {
  estado: "NO_VERIFICADO",
  entidadFinanciera: null,
  fechaVerificacion: null,
  vigenteHasta: null,
  fuente: null,
};

const ALERTAS_MOCK: Alerta[] = [
  {
    id: 1,
    entidadId: 101,
    entidad: "Banco Andino Demo",
    tipo: "TASA",
    tasaAnterior: "4.50%",
    tasaNueva: "3.80%",
    variacionPct: "-15.56%",
    calificacionAnterior: null,
    calificacion: "A-",
    coberturaFSD: cubierta("Banco Andino Demo"),
    leida: false,
    creadaEn: "2026-11-12T14:30:00Z",
  },
  {
    id: 2,
    entidadId: 102,
    entidad: "Caja Rimay Demo",
    tipo: "TASA",
    tasaAnterior: "6.00%",
    tasaNueva: "7.50%",
    variacionPct: "+25.00%",
    calificacionAnterior: null,
    calificacion: "B",
    coberturaFSD: noCubierta("Caja Rimay Demo"),
    leida: false,
    creadaEn: "2026-11-12T16:05:00Z",
  },
  {
    id: 3,
    entidadId: 103,
    entidad: "Financiera Sol Demo",
    tipo: "RIESGO",
    tasaAnterior: null,
    tasaNueva: null,
    variacionPct: null,
    calificacionAnterior: "A-",
    calificacion: "C",
    coberturaFSD: NO_VERIFICADA,
    leida: false,
    creadaEn: "2026-11-13T09:10:00Z",
  },
  {
    id: 4,
    entidadId: 104,
    entidad: "Cooperativa Quipu Demo",
    tipo: "TASA",
    tasaAnterior: "3.00%",
    tasaNueva: "3.30%",
    variacionPct: "+10.00%",
    calificacionAnterior: null,
    calificacion: null,
    coberturaFSD: cubierta("Cooperativa Quipu Demo"),
    leida: true,
    creadaEn: "2026-11-11T11:00:00Z",
  },
  {
    id: 5,
    entidadId: 105,
    entidad: "Mutual Inti Demo",
    tipo: "RIESGO",
    tasaAnterior: null,
    tasaNueva: null,
    variacionPct: null,
    calificacionAnterior: "B+",
    calificacion: "A-",
    coberturaFSD: cubierta("Mutual Inti Demo"),
    leida: false,
    creadaEn: "2026-11-13T18:45:00Z",
  },
];

/** Devuelve una copia, para que una prueba que cambie una alerta no altere los datos originales. */
export function alertasMock(): Alerta[] {
  return ALERTAS_MOCK.map((alerta) => ({ ...alerta, coberturaFSD: { ...alerta.coberturaFSD } }));
}
