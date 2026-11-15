// Prueba de humo de la API: levanta el backend compilado con una base de datos NUEVA y temporal,
// recorre los endpoints principales como lo haría el frontend y guarda cada respuesta normalizada.
// Sirve para comparar el comportamiento ANTES y DESPUÉS de un cambio de persistencia.
//
// Uso (desde la raíz del repo, con el backend ya compilado: npm run build --prefix backend):
//   node scripts/smoke-api.mjs <carpeta-de-salida>
// Comparar dos corridas:
//   node scripts/smoke-api.mjs --diff <carpeta-antes> <carpeta-despues>
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const backendDir = path.join(root, "backend");

// Cambios de comportamiento ESPERADOS: se guardan, pero no cuentan como diferencia en --diff.
const EXPECTED_CHANGES = new Set(["perfil-get-basico", "perfil-put-basico"]);

// Campos que cambian en cada corrida (fechas, tokens, ids generados): se reemplazan por "<dinamico>".
const DYNAMIC_KEYS = new Set([
  "createdAt", "updatedAt", "savedAt", "expiresAt", "planExpiresAt", "generatedAt", "processedAt",
  "occurredAt", "paidAt", "date", "tokenJwt", "token", "transactionId", "reference", "receiptId",
  "authorizationCode", "requestedAt",
]);

function normalize(value, key = "") {
  if (DYNAMIC_KEYS.has(key)) return "<dinamico>";
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalize(value[k], k)]));
  }
  if (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return "<uuid>";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && key !== "publishedAt" && key !== "reportDate") {
    return "<dinamico>";
  }
  return value;
}

function diff(beforeDir, afterDir) {
  const names = new Set([...readdirSync(beforeDir), ...readdirSync(afterDir)]);
  let differences = 0;
  for (const name of [...names].sort()) {
    const id = name.replace(/\.json$/, "");
    const read = (dir) => { try { return readFileSync(path.join(dir, name), "utf-8"); } catch { return null; } };
    const before = read(beforeDir);
    const after = read(afterDir);
    if (before === after) continue;
    if (EXPECTED_CHANGES.has(id)) {
      console.log(`~ ${id}: cambio esperado (revisar a mano)`);
      continue;
    }
    differences += 1;
    console.log(`✗ ${id}: DIFERENTE`);
    console.log(`  antes:   ${before ?? "(no existe)"}`.slice(0, 600));
    console.log(`  después: ${after ?? "(no existe)"}`.slice(0, 600));
  }
  console.log(differences === 0 ? "\n✓ Sin diferencias inesperadas." : `\n✗ ${differences} diferencia(s) inesperada(s).`);
  process.exit(differences === 0 ? 0 : 1);
}

if (process.argv[2] === "--diff") diff(process.argv[3], process.argv[4]);
else await run(process.argv[2]);

async function run(outDir) {
  if (!outDir) {
    console.error("Uso: node scripts/smoke-api.mjs <carpeta-de-salida>");
    process.exit(2);
  }
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // El repositorio JSON de perfiles (US16) escribe en backend/data/perfiles.json: se respalda y se restaura
  const profilesFile = path.join(backendDir, "data", "perfiles.json");
  let profilesBackup = null;
  try { profilesBackup = readFileSync(profilesFile, "utf-8"); } catch { /* ya no existe */ }

  const tempDir = mkdtempSync(path.join(tmpdir(), "yupay-smoke-"));
  const dbFile = path.join(tempDir, "smoke.sqlite");
  const port = 4100 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["dist/index.js"], {
    cwd: backendDir,
    env: {
      ...process.env, PORT: String(port), DB_PATH: dbFile, USER_DB_PATH: dbFile,
      JWT_SECRET: "smoke-secret", RECOVERY_EMAIL_MODE: "console", SUBSCRIPTION_WEBHOOK_SECRET: "smoke-webhook",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  server.stderr.on("data", (chunk) => { stderr += chunk; });

  let failures = 0;
  const save = (id, data) => writeFileSync(path.join(outDir, `${id}.json`), `${JSON.stringify(normalize(data), null, 2)}\n`);

  async function call(id, method, url, { token, body, binary = false } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${base}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const contentType = response.headers.get("content-type") ?? "";
    let payload;
    if (binary || !contentType.includes("application/json")) {
      const bytes = Buffer.from(await response.arrayBuffer());
      payload = { contentType: contentType.split(";")[0], nonEmpty: bytes.length > 0, startsWith: bytes.subarray(0, 5).toString("latin1") };
    } else {
      payload = await response.json();
    }
    if (id) save(id, { status: response.status, body: payload });
    return { status: response.status, body: payload };
  }

  function expect(id, condition, message) {
    if (!condition) { failures += 1; console.error(`✗ ${id}: ${message}`); }
  }

  try {
    // Esperar a que el backend responda
    for (let i = 0; ; i += 1) {
      try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* aún arrancando */ }
      if (i > 50) throw new Error(`El backend no arrancó.\n${stderr}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await call("plans", "GET", "/api/plans");

    // Ahorros (US09/US11/US17/US18/US19/US21)
    await call("ahorros-default", "GET", "/api/ahorros/rentabilidad");
    await call("ahorros-saldo-compuesta", "GET", "/api/ahorros/rentabilidad?dias=180&criterio=SALDO&algoritmo=compuesta");
    await call("ahorros-filtro-saldo", "GET", "/api/ahorros/rentabilidad?saldoMinimo=900&saldoMaximo=6000");

    // Plazo fijo anónimo (US10/US12/US13), todos los departamentos y modalidades
    for (const department of ["Lima", "Cusco", "Arequipa", "Tacna"]) {
      for (const paymentMode of ["AT_MATURITY", "MONTHLY"]) {
        await call(`dpf-anon-${department}-${paymentMode}`, "POST", "/api/simulations/fixed-deposits",
          { body: { amount: "1000.00", termDays: 360, department, paymentMode } });
      }
    }
    await call("dpf-anon-monto-minimo", "POST", "/api/simulations/fixed-deposits",
      { body: { amount: "600.00", termDays: 180, department: "Lima", paymentMode: "AT_MATURITY" } });

    // Registro y login (US01–US03)
    const email = "smoke.user@example.com";
    const password = "Smoke12345!";
    const register = await call("registro", "POST", "/api/users/register", { body: { username: "smoke", email, password } });
    expect("registro", register.status === 201 || register.status === 200, `status ${register.status}`);
    await call("registro-duplicado", "POST", "/api/users/register", { body: { username: "smoke2", email, password } });
    const login = await call("login", "POST", "/api/auth/login", { body: { email, password } });
    const token = login.body?.session?.tokenJwt;
    expect("login", typeof token === "string", "no devolvió session.tokenJwt");

    // Usuario Básico: riesgo oculto, informe y PDF bloqueados (US27/US30)
    await call("dpf-basico-Lima", "POST", "/api/simulations/fixed-deposits",
      { token, body: { amount: "1000.00", termDays: 360, department: "Lima", paymentMode: "AT_MATURITY" } });
    await call("informe-basico-1", "GET", "/api/risk-reports/1", { token });
    await call("perfil-get-basico", "GET", "/api/perfil", { token });
    await call("perfil-put-basico", "PUT", "/api/perfil", { token, body: { nombre: "Smoke Editado", correo: "smoke.editado@example.com" } });

    // Pago simulado: pasa a Pro (US32/US33)
    const checkout = await call("checkout-aprobado", "POST", "/api/checkout/simulate",
      { token, body: { planId: "PRO", scenarioId: "DEMO_APPROVED", billing: { name: "Smoke", email: "smoke.editado@example.com" } } });
    expect("checkout-aprobado", checkout.status === 200 || checkout.status === 201, `status ${checkout.status}`);

    // Usuario Pro: riesgo visible (US25), informes (US26), PDF (US30), favoritos (US28/US29)
    for (const department of ["Lima", "Cusco"]) {
      for (const paymentMode of ["AT_MATURITY", "MONTHLY"]) {
        await call(`dpf-pro-${department}-${paymentMode}`, "POST", "/api/simulations/fixed-deposits",
          { token, body: { amount: "2500.50", termDays: 720, department, paymentMode } });
      }
    }
    for (const entityId of [1, 2, 3, 4, 5, 6, 999]) {
      await call(`informe-pro-${entityId}`, "GET", `/api/risk-reports/${entityId}`, { token });
    }
    await call("pdf-pro", "POST", "/api/reports/solvency",
      { token, binary: true, body: { amount: "1000.00", termDays: 360, department: "Lima", paymentMode: "AT_MATURITY" } });
    await call("favorito-ahorros", "POST", "/api/favorites", { token, body: { instrument: "AHORROS", accountId: "AH-001", days: 365 } });
    await call("favorito-dpf", "POST", "/api/favorites",
      { token, body: { instrument: "PLAZO_FIJO", productId: 1, amount: "1000.00", termDays: 360, department: "Lima", paymentMode: "MONTHLY" } });
    const favorites = await call("favoritos-lista", "GET", "/api/favorites", { token });
    expect("favoritos-lista", favorites.status === 200, `status ${favorites.status}`);
  } catch (error) {
    failures += 1;
    console.error(error instanceof Error ? error.message : error);
  } finally {
    server.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    rmSync(tempDir, { recursive: true, force: true });
    if (profilesBackup !== null) writeFileSync(profilesFile, profilesBackup);
  }

  console.log(`${readdirSync(outDir).length} respuestas guardadas en ${outDir}`);
  if (failures > 0) {
    console.error(`✗ ${failures} verificación(es) fallaron.`);
    process.exit(1);
  }
  console.log("✓ Prueba de humo completa.");
}
