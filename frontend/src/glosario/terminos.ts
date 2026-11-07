export const TERMINOS = [
  { termino: "Capital inicial", definicion: "Dinero que depositas o inviertes al comenzar." },
  { termino: "Costo de mantenimiento", definicion: "Comisión periódica por mantener una cuenta. Puede reducir el rendimiento de tus ahorros." },
  { termino: "Depósito a plazo fijo", definicion: "Dinero depositado durante un plazo acordado con una entidad. Revisa las condiciones para retirarlo antes del vencimiento." },
  { termino: "FSD", definicion: "Fondo de Seguro de Depósitos. Protege depósitos elegibles en entidades miembros ante insolvencia, hasta el límite y bajo las condiciones vigentes. Una cobertura no verificada no confirma ni descarta la protección.", fuente: "https://www.sbs.gob.pe/usuarios/aprende-con-la-sbs/fondo-de-seguro-de-depositos" },
  { termino: "Interés", definicion: "Dinero que genera un depósito durante un periodo según su tasa y condiciones. El interés mostrado en la simulación no garantiza un rendimiento futuro." },
  { termino: "Rentabilidad", definicion: "Rendimiento de una inversión respecto al dinero invertido durante un periodo. Debes considerar también sus costos y riesgos." },
  { termino: "Riesgo", definicion: "Posibilidad de pérdidas o de que el resultado difiera del esperado. No equivale a cobertura FSD. El semáforo actual del proyecto utiliza datos de demostración." },
  { termino: "Saldo final", definicion: "Capital inicial más los intereses del periodo en esta simulación. Los cargos que no descuenta el cálculo deben revisarse por separado." },
  { termino: "TEA", definicion: "Tasa Efectiva Anual: tasa de interés expresada para un año que considera la capitalización. Por sí sola no refleja todos los cargos de una cuenta.", fuente: "https://www.sbs.gob.pe/usuarios/informacion-financiera/depositos" },
  { termino: "TREA", definicion: "Tasa de Rendimiento Efectiva Anual: permite comparar el rendimiento de un depósito considerando sus intereses y cargos aplicables. El proyecto no calcula actualmente esta tasa.", fuente: "https://www.sbs.gob.pe/usuarios/informacion-financiera/depositos" },
].sort((a, b) => a.termino.localeCompare(b.termino, "es"));

export const TERMINO_POR_COLUMNA: Record<string, string> = {
  capitalInicial: "Capital inicial", interesGenerado: "Interés", saldoFinal: "Saldo final",
  coberturaFSD: "FSD", riesgo: "Riesgo", monthlyMaintenanceFee: "Costo de mantenimiento",
};
