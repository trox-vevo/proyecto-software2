# proyecto-software2

Repositorio del proyecto

# Yupay Finance

## Estructura

- `frontend/`: React + TypeScript (Vite)
- `backend/`: Express + TypeScript

## Cómo ejecutar

```bash
cd backend && npm install && npm run dev     # http://localhost:3000
cd frontend && npm install && npm run dev    # http://localhost:5173
```

## Correo para recuperación de contraseña

El backend envía los enlaces por SMTP. Copia `backend/.env.example` a `backend/.env`
y completa las credenciales de tu proveedor. Para SMTP con TLS implícito usa el
puerto `465` y `SMTP_SECURE=true`; para STARTTLS suele usarse el puerto `587` y
`SMTP_SECURE=false`. En Gmail se requiere una contraseña de aplicación, no la
contraseña normal de la cuenta. No subas el archivo `.env` ni compartas sus secretos.

La solicitud se realiza en `POST /api/auth/forgot-password`. Los tokens expiran
en una hora y solo se conserva su hash en SQLite.

Para probar el flujo local sin correo real, configura `RECOVERY_EMAIL_MODE=console`
en `backend/.env` y `FRONTEND_URL=http://localhost:5173`. El backend imprimirá
el enlace de recuperación en su terminal. Este modo se rechaza si
`NODE_ENV=production`; no debe habilitarse en despliegues reales.

## Suscripciones Pro

El backend degrada las suscripciones vencidas desde el job de mantenimiento y
registra el motivo y la fecha en el historial consultable por el usuario en
`GET /api/subscription/history`. Un fallo definitivo de renovación se recibe en
`POST /api/subscription/renewal-payment-failure`, autenticado mediante el
encabezado `X-Subscription-Webhook-Secret`. Configura
`SUBSCRIPTION_WEBHOOK_SECRET` con un secreto aleatorio del entorno; el cuerpo
incluye `eventId`, `userId`, `periodExpiresAt` y `occurredAt`. Los eventos
duplicados se procesan una sola vez. Un rechazo de checkout de compra inicial
no se considera por sí solo un fallo de renovación.

El historial de facturación de la US34 se consulta en
`GET /api/checkout/history`; los comprobantes PDF de cada operación están en
`GET /api/checkout/history/:reference/receipt`. Ambos endpoints requieren la
sesión del usuario y solo exponen sus propias operaciones. El checkout vigente
es una simulación académica: no realiza cobros y el precio de Pro sigue sin
definirse, por lo que el historial no atribuye montos ficticios.

## Perfil de usuario

El perfil del usuario con sesión se sirve mediante `GET /api/perfil` y se actualiza con
`PUT /api/perfil`, enviando `nombre` y `correo` como JSON. Los datos se guardan en la
tabla `users` de la base única; los correos deben ser únicos. Sin sesión se responde `401`.
En la interfaz, el botón **Mi perfil** abre la página `/perfil`, donde se agrupan
la edición del perfil y las preferencias de notificación.

La US37 ofrece preferencias de notificación a usuarios Pro en
`GET /api/notifications/preferences` y `PUT /api/notifications/preferences`.
El cuerpo admite `alertTypes` (`CAMBIO_TASA` y/o `CAMBIO_RIESGO`) y `frequency`
(`INMEDIATA` o `RESUMEN_DIARIO`). Las preferencias se guardan por usuario en
SQLite; las cuentas Básicas reciben un `403` con la indicación para actualizar
su plan.

## SQLite e integraci?n del Sprint 1

La base `backend/data/usuarios.sqlite` es un archivo local de ejecuci?n y permanece
ignorada por Git. Una instalaci?n nueva genera el esquema num?rico al iniciar.
Si ya existe una base con IDs TEXT, el servidor la conserva y solicita una
migraci?n expl?cita; no cambia sus datos al arrancar. El procedimiento de
[copia con respaldo](docs/MIGRACION_IDENTIFICADORES.md) admite usuarios, favoritos
y tokens de recuperaci?n de los esquemas documentados. No reemplaces una base
local por un archivo descargado del repositorio.

Consulta [la integraci?n de Sprint 1 con main](docs/INTEGRACION_SPRINT1_MAIN.md)
para las decisiones, pruebas y dependencias de esta entrega.

## Base de datos

Toda la persistencia usa **un solo archivo SQLite**, indicado con `DB_PATH` (por defecto
`data/usuarios.sqlite`; `USER_DB_PATH` se acepta por compatibilidad). Ahí viven los usuarios,
los pagos, los favoritos y el catálogo financiero (entidades, plazo fijo, cuentas de ahorro,
indicadores SBS e informes del economista).

- El catálogo se crea y llena solo al arrancar con `backend/db/schema.sql` y `backend/db/seed.sql`.
  Es idempotente: reiniciar no duplica filas.
- Las tablas de usuarios, pagos y favoritos las crean sus propios repositorios.
- Para regenerar el script de creación completo:
  `npm run build --prefix backend && node scripts/export-schema.mjs docs/BaseDeDatos/schema.sql`.
- En Railway: `DB_PATH=/data/yupay.sqlite` sobre un volumen montado en `/data`, para que la base
  sobreviva a los redespliegues.

## Verificación de la integración US06 y US12

Instala con `npm ci --prefix frontend` y `npm ci --prefix backend`. Ejecuta `npm test` en la raíz para correr ambas suites, builds y linters. Los reportes quedan en `.test-results/`. Las pruebas frontend usan jsdom y HTTP simulado. La aprobación UX y los criterios financieros de TS-66 requieren revisión del equipo.
