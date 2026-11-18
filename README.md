# Yupay Finance

Aplicación web que compara **cuentas de ahorro** y **depósitos a plazo fijo** de entidades financieras del Perú. Simula las ganancias y explica el riesgo en lenguaje sencillo.

Proyecto del curso **Ingeniería de Software II** (Universidad de Lima), desarrollado con Scrum en tres sprints.

## Demo en línea

**https://yupayfinance.up.railway.app/**

| Usuario de prueba | Correo | Contraseña |
|---|---|---|
| Plan Pro | `pro@prueba.com` | `12345678` |
| Plan Básico | `basico@prueba.com` | `12345678` |

> Cuentas de demostración. Los nombres de las entidades son reales, pero **las tasas, canales, comisiones, calificaciones SBS e informes son ficticios**. Solo la participación en el FSD proviene de una consulta oficial (15/11/2026, revisión local vigente hasta el 15/12/2026). El checkout es una **simulación**: no realiza cobros y acepta cualquier dato de tarjeta con formato válido.

## Funcionalidades

| Módulo | Qué hace | HU |
|---|---|---|
| Cuentas | Registro, inicio de sesión, recuperación de contraseña y perfil | US01–US03, US14–US16 |
| Simulación de ahorros | Busca por monto y departamento; muestra tasa (TEA), monto mínimo, interés, saldo final, riesgo, FSD y costo de mantenimiento | US04, US05, US08, US09, US11, US13 |
| Simulación de plazo fijo | Monto mínimo de S/ 500; cálculo al vencimiento o mensual (Strategy) para plazos de 180 a 1080 días | US06, US07, US10, US12 |
| Filtros en el cliente | Sin costo de mantenimiento, agencias, cajeros, banca digital y app móvil, combinables (AND) y sin nueva petición | US17–US20 |
| Riesgo y FSD | Semáforo basado en la calificación SBS, cobertura FSD verificada y glosario financiero | US21–US24, US35 |
| Plan Pro (S/ 9.90 al mes) | Calificación SBS e informe del economista, favoritos con historial, reporte PDF, alertas de cambios de tasa y riesgo por correo | US25–US30, US36–US40 |
| Suscripción | Comparación de planes, checkout simulado, historial de facturación con comprobantes, cancelación y degradación automática | US31–US34, US41–US43 |

Pantallas: `/`, `/registro`, `/login`, `/simular/ahorros`, `/simular/plazo-fijo`, `/planes`, `/checkout`, `/favoritos`, `/perfil`, `/suscripcion`, `/facturacion`.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript (Vite), Vitest + React Testing Library |
| Backend | Node.js **24** + Express 5 + TypeScript (modo strict), Vitest |
| Base de datos | Un solo archivo SQLite (`node:sqlite`) |
| Dinero | `decimal.js`; los importes viajan como texto con 2 decimales |
| Despliegue | Railway (Railpack), un solo servicio que sirve la API y el frontend compilado |

**Arquitectura:** Clean Architecture con DDD por *bounded context* (`domain` → `application` → `infrastructure` → `interface`). Patrones: Strategy (calculadoras), Specification (filtros), Repository (persistencia detrás de interfaces), Gateway (pago simulado) y Middleware (acceso Pro).

## Estructura

```
frontend/   React + Vite (pantallas, componentes y pruebas)
backend/    API Express
  src/        un módulo por contexto: simulation, rentabilidad, risk, fsd, favorites, alertas, ...
  db/         schema.sql y seed.sql del catálogo (se aplican al arrancar)
  data/       JSON de respaldo para pruebas y base local (ignorada por Git)
docs/       documentación de sprints, integraciones y script de la base de datos (BaseDeDatos/)
scripts/    pruebas de humo, exportación del esquema y migraciones manuales
```

## Ejecutar en local

Requisito: **Node.js 24** (`node -v` → `v24.x`). Con Node 26 fallan algunas pruebas del backend.

```bash
# Backend (http://localhost:3000)
cd backend
cp .env.example .env
npm install
npm run dev

# Frontend (http://localhost:5173), en otra terminal
cd frontend
npm install
npm run dev
```

Con `RECOVERY_EMAIL_MODE=console` (valor de `.env.example`), los enlaces de recuperación y los correos de alertas se imprimen en la terminal del backend, sin enviar correos reales.

### Variables de entorno principales (`backend/.env`)

| Variable | Uso |
|---|---|
| `DB_PATH` | Archivo SQLite único (por defecto `data/usuarios.sqlite`) |
| `JWT_SECRET` | Secreto de las sesiones. **Obligatorio fuera del entorno local** |
| `FRONTEND_URL` | Base de los enlaces de recuperación de contraseña |
| `RECOVERY_EMAIL_MODE=console` | Imprime los correos en la terminal. Se rechaza con `NODE_ENV=production` |
| `SMTP_*` | Envío de correos reales (Gmail requiere contraseña de aplicación) |
| `MARKET_MONITORING_*`, `ALERT_EMAIL_JOB_ENABLED` | Monitoreo del catálogo y envío de alertas Pro |
| `SUBSCRIPTION_WEBHOOK_SECRET` | Autentica el webhook de fallo de renovación |

Nunca subas `.env` ni secretos al repositorio.

## Pruebas

```bash
cd backend && npm run lint && npm test     # 550 pruebas
cd frontend && npm run lint && npm test    # 390 pruebas
npm test                                   # en la raíz: ambas suites, builds y linters (reportes en .test-results/)
```

Prueba de humo de la API (levanta el backend con una base temporal):

```bash
npm run build --prefix backend
node scripts/smoke-api.mjs salida/
```

## Base de datos

Toda la persistencia (usuarios, pagos, favoritos, alertas y catálogo financiero) está en **un solo archivo SQLite** indicado por `DB_PATH`.

- El catálogo se crea y se llena al arrancar con `backend/db/schema.sql` y `backend/db/seed.sql`. Es idempotente (`CREATE TABLE IF NOT EXISTS` / `INSERT OR IGNORE`), así que reiniciar no duplica filas.
- Las tablas de usuarios, pagos y favoritos las crean sus propios repositorios.
- Script completo de creación (entregable): [`docs/BaseDeDatos/schema.sql`](docs/BaseDeDatos/schema.sql). Para regenerarlo:
  ```bash
  npm run build --prefix backend
  node scripts/export-schema.mjs docs/BaseDeDatos/schema.sql
  ```
- Bases locales antiguas: si el backend pide una migración explícita (US21), sigue [`docs/MIGRACION_IDENTIFICADORES.md`](docs/MIGRACION_IDENTIFICADORES.md) y [`docs/US21_AHORROS_FSD.md`](docs/US21_AHORROS_FSD.md). No reemplaces tu base por un archivo descargado.

## Despliegue (Railway)

Un solo servicio sobre la rama `main`, que se redespliega en cada merge:

- **Build:** `npm run build`. Compila el frontend con `VITE_API_URL` vacío, para usar el mismo origen, y luego el backend.
- **Start:** `npm start`. El backend sirve `/api/*` y el frontend compilado (`FRONTEND_DIST`).
- **Node:** 24 (`engines`, `.nvmrc` y `RAILPACK_NODE_VERSION=24`).
- **Volumen** montado en `/data` y `DB_PATH=/data/<archivo>.sqlite`, para que la base sobreviva a los redespliegues.
- `NODE_ENV=development` + `RECOVERY_EMAIL_MODE=console`: la demo no envía correos reales. Para producción real: `NODE_ENV=production`, `SMTP_*` y `JWT_SECRET`.
- El dominio público apunta al puerto **8080**.

## Documentación

- Sprints: [`docs/SPRINT1.md`](docs/SPRINT1.md), [`docs/SPRINT2.md`](docs/SPRINT2.md), [`docs/SPRINT3.md`](docs/SPRINT3.md)
- Integraciones: [`docs/INTEGRACION_SPRINTS1_2_MAIN.md`](docs/INTEGRACION_SPRINTS1_2_MAIN.md), [`docs/INTEGRACION_SPRINT3_MAIN.md`](docs/INTEGRACION_SPRINT3_MAIN.md)
- Alertas automáticas: [`docs/ALERTAS_AUTOMATICAS.md`](docs/ALERTAS_AUTOMATICAS.md)
- FSD: [`docs/CORRECCION_FSD.md`](docs/CORRECCION_FSD.md), [`docs/US21_VERIFICACION_REAL.md`](docs/US21_VERIFICACION_REAL.md)

## Equipo

Alejandro · Joaquín · Gabriel · Adriano · Renato Apaza · Renato Almeyda · Renato Cuadrado

