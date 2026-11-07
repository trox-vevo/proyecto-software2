# Integración de main en Sprint 1 — 7 de noviembre de 2026

Rama de trabajo: `feat/sprint1-us01-us02-completo`, worktree `.worktrees/sprint1`.
Pull Request existente: https://github.com/trox-vevo/proyecto-software2/pull/10.

## Auditoría inicial y causa de los conflictos

Se verificó el remoto `https://github.com/trox-vevo/proyecto-software2.git` y se ejecutó `git fetch origin`. La rama del Sprint 1 estaba limpia, sin cambios locales pendientes, en `df8c7430a2146e8db4535dc6b2f564480d795cd6`. La referencia actualizada de main era `3baf458c3548814d4fefa9f9ffec60871dfec818`; la base común era `a7afd4622a01aabf022584e5b3aed9bf6ba32b70`.

El registro original ya había llegado a main a través del trabajo del equipo. Después ambas ramas modificaron las mismas líneas para asignar IDs numéricos: Sprint 1 añadió validación de enteros seguros y migración explícita; main añadió planes, autenticación, recuperación y conversión automática de bases. Git no puede decidir cómo combinar esas implementaciones ni sus pruebas.

La simulación `git merge-tree` identificó exactamente cuatro conflictos de contenido, sin conflictos adicionales:

| Archivo | Resolución |
| --- | --- |
| `backend/src/registration/application/RegistrationService.ts` | Unificar `NewUser`, dejar que SQLite asigne el ID, conservar validaciones y scrypt, validar el ID guardado antes de devolver los campos públicos y conservar el plan del repositorio. |
| `backend/src/registration/infrastructure/SqliteUserRepository.ts` | Conservar transacción y control del rango seguro de Sprint 1, incorporar los métodos de recuperación y lectura de planes de main, activar claves foráneas y mantener la migración explícita. |
| `backend/tests/registration/registration.test.ts` | Mantener ambas baterías, unificar importación SQLite, conservar reapertura y PRO y adaptar la migración de usuarios/tokens a una copia explícita con respaldo. Añadir protecciones de referencias y límites de recuperación. |
| `frontend/src/registration/RegistrationForm.test.tsx` | Conservar tanto el rechazo de respuestas con IDs inválidos como la persistencia, restauración y cierre de sesión de main. Los mocks de éxito devuelven el contrato real `{ user: { id: number } }`. |

La revisión posterior encontró también una duplicación de `NewUser` en un archivo combinado automáticamente por Git. `User.ts` conserva la definición única y `UserRepository.ts` la importa y reexporta para mantener compatibilidad con ambos puntos de importación.

## Cambios encontrados en main

Los commits de Adriano, registrados por Git como `cabrerajumi`, incluyen inicio de sesión, recuperación/restablecimiento de contraseña y, en `3baf458`, IDs numéricos y sesión persistente:

- `AuthService`, controlador y rutas de login, sesiones en memoria, JWT firmado, middleware opcional y secreto compartido.
- `Session.userId: number`, `RecoveryTokenRepository` con referencias numéricas y JWT con `sub: String(user.id)`. El middleware valida ese subject y lo expone como `req.userId: number`.
- `UserPlan` con `BASICO | PRO`, lectura del plan SQLite y propagación al login y a la sesión.
- Solicitud de recuperación con respuesta genérica, hash del token, vencimiento, envío por SMTP o consola local, eliminación de tokens no entregados e invalidación de los anteriores tras el envío.
- Restablecimiento transaccional de contraseña, scrypt nuevo e invalidación de todos los tokens activos de la cuenta.
- Vistas de login, olvido y restablecimiento, almacenamiento y restauración de sesión, cierre local de sesión y envío del bearer token desde el frontend.

Main también contiene aportes de otros compañeros: perfil de demostración con persistencia JSON y validación de correo, filtros y estado vacío US13. Esos módulos, sus estilos, rutas y pruebas se incorporaron. No se atribuyen todos los cambios de main a una sola persona.

## Decisiones y conservación de comportamiento

### Identificadores y persistencia

Se conserva `User.id` y sus referencias como enteros positivos seguros de JavaScript, generados por SQLite. La lectura usa bigint antes de validar; no convierte UUID ni acepta IDs proporcionados por el cliente. Las sesiones mantienen su ID opaco de seguridad como string; el subject JWT es la representación textual canónica del ID numérico, conservando el contrato de main y su middleware.

La creación de usuarios conserva `BEGIN IMMEDIATE`, la comprobación de correo dentro de la reserva de escritura y el índice UNIQUE NOCASE. Así se mantienen 201/409 incluso con concurrencia y al alcanzar MAX_SAFE_INTEGER. La lectura conserva el plan PRO; las altas nuevas siguen siendo BASICO.

El mismo adaptador SQLite implementa `UserRepository` y `RecoveryTokenRepository`, evitando repositorios o tablas duplicados. Se conservaron los métodos de invalidación, creación, borrado, validación y uso transaccional de tokens. Sus IDs se validan como números seguros y los inserts fallidos se revierten. Se habilitó `PRAGMA foreign_keys = ON`.

### Incompatibilidad resuelta con decisión del usuario

Main convertía automáticamente las bases con IDs TEXT al abrir el repositorio. Sprint 1 exigía migración explícita. Se detuvo esa decisión y se consultó al usuario; eligió **migración explícita con respaldo**. El constructor comprueba el esquema antes de hacer DDL y rechaza usuarios o referencias de recuperación TEXT sin alterarlos.

La herramienta de copia se amplió para admitir el esquema conocido de `password_recovery_tokens`, además de usuarios y favoritos. Mantiene propietario mediante el mapa, ID del token, hash, vencimiento, estado, fecha y secuencia AUTOINCREMENT, incluso tras borrados. Comprueba integridad, relaciones y recuentos. Los esquemas desconocidos siguen rechazándose; no se amplió la aceptación indiscriminadamente. El nuevo resultado incluye `recoveryTokens`.

La prueba de main que esperaba conversión automática ahora ejecuta la copia explícita. Conserva las comprobaciones de cuenta, plan PRO y cambio de contraseña mediante el token preservado; añade la comprobación de bytes intactos del origen. No se omitió la prueba ni se sustituyeron sus aserciones por verificaciones más débiles.

### Protección de archivos locales

No había cambios locales de código, pero sí una base ignorada en `backend/data/usuarios.sqlite`. Main incorporaba un binario versionado en esa misma ruta. Antes del merge se respaldó y apartó el archivo local, verificando su SHA-256; se utilizó `--no-overwrite-ignore`.

El binario de main se conservó por separado. Se excluyó la base de ejecución del índice de esta rama y se restauró la base local original. La regla `.gitignore` existente sigue protegiéndola. No se borraron cuentas ni se ejecutó ninguna migración real. El binario de main permanece recuperable en su historial y en el respaldo local; no forma parte del nuevo árbol de la rama.

Respaldos locales fuera del envío: `.tools/sprint1-integration-20261107/usuarios.local.original.sqlite`, `usuarios.local.backup.sqlite`, `usuarios.main.original.sqlite` y `usuarios.main.sqlite`.

SHA-256 de la base local antes y después: `ad4168a37a7181dd16e7937d014104173b36dd4992690ad16597fd9b1f7cb3c3`.

## Verificación

Con Node 24.22.2, dependencias del lockfile de main y exclusivamente bases sintéticas temporales:

| Control | Resultado |
| --- | --- |
| Backend: `npm.cmd run coverage -- --maxWorkers=2` | 158 pruebas aprobadas en 15 archivos; 0 fallidas. |
| Backend: `npm.cmd run build` | Aprobado. |
| Backend: `npm.cmd run lint` | Aprobado. |
| Frontend: `npm.cmd test -- --coverage --coverage.include=src/** --maxWorkers=2` | 56 pruebas aprobadas en 8 archivos; 0 fallidas. |
| Frontend: `npm.cmd run build` | Aprobado. |
| Frontend: `npm.cmd run lint -- --ignore-pattern coverage` | Aprobado; solo se excluye el reporte generado. |

Cobertura global de líneas: backend 89,81 %, frontend 85,01 %. Son mediciones del conjunto integrado; no se comparan directamente con la cobertura de la versión que todavía no contenía estos módulos.

Se verificaron validaciones US01, scrypt, campos públicos, normalización, duplicados sin distinguir mayúsculas, concurrencia, registro HTTP, IDs seguros, reapertura SQLite y rollback. Las 31 pruebas de migración incluyen ahora recuperación, secuencia, huérfanos y rechazo de esquemas desconocidos.

La nueva prueba `backend/tests/auth/registrationAuth.integration.test.ts` recorre registro HTTP, cierre y reapertura SQLite, rechazo de duplicado, login BASICO y PRO, firma JWT, recuperación con correo simulado, restablecimiento, rechazo de contraseña anterior y token de un solo uso. Las pruebas incorporadas de main cubren además SMTP con adaptador simulado, perfil JSON/API, vistas de recuperación, persistencia de sesión, filtros y estado vacío.

No se eliminó ningún archivo de pruebas de ninguna rama. Se conservaron los casos existentes y se añadieron comprobaciones; la única expectativa funcional modificada fue la migración automática, sustituida por el procedimiento elegido expresamente por el usuario. No se añadieron `.skip` ni `.todo`.

## Historial y alcance de publicación

La integración se prepara como merge de dos padres, sin rebase ni reescritura: Sprint 1 en `df8c743` y main en `3baf458`. El destino autorizado es únicamente `feat/sprint1-us01-us02-completo`, mediante push normal. El PR existente es el #10; no se crea otro ni se fusiona. Main, Sprint 2 y Sprint 3 quedan fuera de las modificaciones.

## Dependencias y límites pendientes

- La base local antigua permanece intacta y el servidor solicita migración explícita si se utiliza. Para operar con esos datos hay que revisar y autorizar el procedimiento y el cambio de `USER_DB_PATH`; una instalación nueva crea una base numérica vacía. No se migraron datos reales.
- Los JWT o sesiones previos a una migración de datos necesitan una política de renovación acordada por su responsable; copiar relaciones SQLite no vuelve a firmar JWT.
- El perfil de main sigue siendo el perfil de demostración `usuario-demo` en JSON, independiente del usuario registrado. Se mantuvo esa funcionalidad y sus pruebas. Asociarlo al usuario autenticado exige una decisión de producto y una historia específica; no se inventó esa asociación ni se convirtió su clave de demostración.
- El envío real de correo requiere la configuración SMTP del proyecto; se verificaron adaptador y flujo con servicios simulados, sin enviar mensajes reales. El secreto JWT de producción debe configurarse en el entorno.
- No se modifican ni se resuelven en esta entrega las futuras integraciones de Sprint 2 o Sprint 3.
