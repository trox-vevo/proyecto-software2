import type { CoberturaFSD } from "../fsd/IndicadorFSD";
import type { Alerta } from "./tipos";

/**
 * TEMPORAL: alertas inventadas para construir US35, US36 y US40 antes de que exista el
 * motor de alertas (US38/US39). Las entidades son ficticias y no representan cobertura real.
 * Cuando exista la API de alertas, se borra este archivo y su uso en el hook.
 *
 * Cubre: alerta de tasa y de riesgo, las tres coberturas FSD, entidad sin datos de la SBS
 * y alertas leídas y no leídas (4 pendientes).
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
    calificacionAnterior: "A-",
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
    calificacionAnterior: "B",
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
    tasaAnterior: "5.20%",
    tasaNueva: "5.20%",
    variacionPct: "0.00%",
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
    tasaAnterior: "4.00%",
    tasaNueva: "4.00%",
    variacionPct: "0.00%",
    calificacionAnterior: "B+",
    calificacion: "A-",
    coberturaFSD: cubierta("Mutual Inti Demo"),
    leida: false,
    creadaEn: "2026-11-13T18:45:00Z",
  },
];

/** Devuelve una copia, para que marcar una alerta como leída no altere los datos originales. */
export function alertasMock(): Alerta[] {
  return ALERTAS_MOCK.map((alerta) => ({ ...alerta, coberturaFSD: { ...alerta.coberturaFSD } }));
}