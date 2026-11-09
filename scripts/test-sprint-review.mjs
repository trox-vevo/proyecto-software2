import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const resultsDirectory = path.join(root, ".test-results");
const temporaryDirectory = path.join(resultsDirectory, "tmp");
const npmCli = process.env.npm_execpath;

if (!npmCli || !["frontend", "backend"].every((part) =>
  existsSync(path.join(root, part, "node_modules", "vitest", "vitest.mjs")))) {
  console.error("Faltan dependencias. Ejecuta npm ci --prefix frontend y npm ci --prefix backend; después, npm test en la raíz.");
  process.exit(1);
}

mkdirSync(temporaryDirectory, { recursive: true });
const environment = { ...process.env, TEMP: temporaryDirectory, TMP: temporaryDirectory };
const steps = [];
const assertions = {};

function execute(part, script, extra = []) {
  console.log(`\n=== ${part.toUpperCase()} | ${script === "test" ? "PRUEBAS AUTOMATIZADAS" : script === "build" ? "COMPILACIÓN" : "ESLINT"} ===\n`);
  const result = spawnSync(process.execPath, [npmCli, "run", script, ...extra], {
    cwd: path.join(root, part), env: environment, stdio: "inherit",
  });
  if (result.error) console.error(result.error.message);
  const passed = result.status === 0;
  steps.push({ name: `${part} / ${script}`, passed });
  return passed;
}

console.log("\nYUPAY FINANCE | EVIDENCIA PARA EL SPRINT REVIEW");
console.log("US06: formulario, seis plazos exactos y conservación temporal de parámetros.");
console.log("US12: tabla de resultados y columna mensual según modalidad.");
console.log("Incluye regresión del backend, compilación y ESLint. No requiere iniciar la app.\n");

for (const part of ["frontend", "backend"]) {
  const report = path.join(resultsDirectory, `${part}.json`);
  rmSync(report, { force: true });
  execute(part, "test", ["--", "--reporter=verbose", "--reporter=json", `--outputFile=${report}`]);
  try {
    const data = JSON.parse(readFileSync(report, "utf8"));
    assertions[part] = data.testResults.flatMap((suite) => suite.assertionResults);
    if (assertions[part].length === 0) throw new Error("El informe no contiene pruebas ejecutadas.");
  } catch (error) {
    console.error(`No se pudo verificar el informe de ${part}: ${error.message}`);
    steps.push({ name: `${part} / informe de pruebas`, passed: false });
    assertions[part] = [];
  }
}

for (const part of ["frontend", "backend"]) {
  execute(part, "build");
  execute(part, "lint");
}

console.log("\n=== RESUMEN POR HISTORIA Y CRITERIO ===\n");
const groups = [
  ["US06 | TS-19, TS-20 y TS-22: cuatro campos, seis plazos, estado y formato decimal", assertions.frontend.filter((test) => test.fullName.startsWith("US06 |"))],
  ["US12 | TS-34 y evidencia automatizada TS-35: tabla, valores y columna mensual", assertions.frontend.filter((test) => test.fullName.startsWith("US12 |"))],
  ["Integración US06 + US12: solicitud, cambios de modalidad, errores y conservación", assertions.frontend.filter((test) => test.fullName.startsWith("Integración US06 + US12 |"))],
  ["Backend: cálculos existentes, validación, HTTP y regresión de ahorros", assertions.backend],
];
for (const [label, tests] of groups) {
  const passed = tests.filter((test) => test.status === "passed").length;
  const complete = tests.length > 0 && passed === tests.length;
  console.log(`[${complete ? "OK" : "REVISAR"}] ${label}: ${passed}/${tests.length} aprobadas`);
  if (!complete) steps.push({ name: label, passed: false });
}

console.log("");
for (const step of steps) console.log(`[${step.passed ? "OK" : "ERROR"}] ${step.name}`);
console.log("\nPENDIENTE: aprobación UX formal de TS-21; los tests no equivalen a su aprobación.");
console.log("US22: contratos TS-66 integrados mediante PR #5; criterios financieros pendientes de aprobacion.");
console.log("TS-67, TS-68 y TS-69 quedan al equipo; no se prueban clasificaciones de riesgo aquí.");
console.log("La UI se prueba en jsdom con HTTP simulado; el backend incluye pruebas HTTP reales.");
console.log("Esto no reemplaza la demostración visual en el navegador.\n");

const failed = steps.some((step) => !step.passed);
console.log(failed ? "RESULTADO: HAY COMPROBACIONES FALLIDAS. Revisa los detalles anteriores." : "RESULTADO: TODAS LAS COMPROBACIONES EJECUTADAS APROBADAS.");
process.exitCode = failed ? 1 : 0;
