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

## Perfil de usuario

El perfil de demostración se sirve mediante `GET /api/perfil` y se actualiza con
`PUT /api/perfil`, enviando `nombre` y `correo` como JSON. Los datos se guardan en
`backend/data/perfiles.json`; los correos deben ser únicos entre los perfiles.

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

## Verificación de la integración US06 y US12

Instala con `npm ci --prefix frontend` y `npm ci --prefix backend`. Ejecuta `npm test` en la raíz para correr ambas suites, builds y linters. Los reportes quedan en `.test-results/`. Las pruebas frontend usan jsdom y HTTP simulado. La aprobación UX y los criterios financieros de TS-66 requieren revisión del equipo.
