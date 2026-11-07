# Sprint 1: US01 y US02

Rama: `feat/sprint1-us01-us02-completo`.
Directorio: `C:\Users\Magaz_\proyecto-software2\.worktrees\sprint1`.
Base: `origin/main`, commit `8cc91626a456e03f52f83ae5e0e143dd6e2405de`, comprobado de nuevo mediante fetch el 4 de noviembre de 2026.

La entrega original fue revisada y publicada el 4 de noviembre de 2026 en el commit `a7afd4622a01aabf022584e5b3aed9bf6ba32b70`, con la autorización de esa entrega. La auditoría del 6 de noviembre corrige sus identificadores mediante cambios locales pendientes de revisión. No autoriza commits, push ni migración de bases existentes. Usa este worktree para revisar y ejecutar el Sprint.

## Análisis y reutilización

El proyecto usa React 19, TypeScript y Vite en frontend; Express 5 y TypeScript en backend. La persistencia previa de ahorros sigue siendo `backend/data/cuentas.json` y los productos a plazo fijo siguen usando el repositorio en memoria de los compañeros.

Se revisaron las ramas remotas `origin/feat/us01-us02-registro` y `origin/feat/us21-us24-sprint2`. De la primera se reutilizaron los seis archivos de `registration`, con ajustes pequeños de composición y cierre de SQLite. El formato `scrypt$salt$hash` sigue siendo compatible con el AuthService de la rama anterior. La entrega original utilizaba UUID. La auditoría del 6 de noviembre los sustituye por identificadores numéricos generados por SQLite y conserva el plan BASICO, la normalización de correo y los estados HTTP del controlador. No se copió su archivo SQLite con usuarios ni se añadieron sus dependencias de JWT.

No había autenticación integrada en main, ni formulario de registro, ni pruebas de registro. Los backlogs completos no estaban en los archivos del repositorio: se usaron TS-01 a TS-08 y los criterios de la solicitud. El documento existente `docs/us22-ts66.md` trata otra historia y permanece intacto.

## Implementación y criterios

| Historia / tareas | Resultado |
| --- | --- |
| US01, TS-01 | Formulario en `/registro`: nombre, correo, contraseña y confirmación; validaciones, errores accesibles y estado de envío. |
| US01, TS-02 | `POST /api/users/register`: valida en servidor, genera salt aleatorio de 16 bytes, deriva hash scrypt y persiste en SQLite. Nunca devuelve contraseña ni hash. |
| US01, TS-03 | Fetch con `VITE_API_URL`, errores HTTP/red, bloqueo de envíos repetidos y redirección a `/login` tras éxito. |
| US01, TS-04/05 | Pruebas de servicio, SQLite, HTTP y formulario; guía manual abajo. |
| US02, TS-06 | Correo normalizado con trim y minúsculas; comprobación previa y `UNIQUE COLLATE NOCASE` como protección definitiva ante carreras. SQLite espera bloqueos hasta 5 segundos. |
| US02, TS-07/08 | HTTP 409 y error asociado al campo de correo; pruebas de duplicados y seis solicitudes simultáneas, exactamente una aceptada. |

En la revisión final se corrigieron dos errores de integración: solo HTTP 201 confirma el registro (un 200 inesperado no se trata como éxito), y abandonar el formulario cancela la espera de la petición para evitar una redirección tardía. También se comprobó el recorrido desde App: enlace Crear cuenta, formulario, confirmación y regreso al simulador.

La consulta `GET /api/users/check-email?email=...` está disponible para integraciones anteriores. La decisión definitiva se toma al insertar en SQLite; el formulario no depende de una comprobación preliminar que pueda quedar desactualizada.

**Dependencia US03:** el inicio de sesión real solo existe parcialmente en `origin/feat/us01-us02-registro` (backend). `/login` es un destino de integración que confirma el registro y explica que falta integrar el inicio de sesión; no autentica. Para completar esa pantalla, se propone revisar US03 en una entrega independiente y adaptarla al repositorio de usuarios inyectado en `createApp`. No se fusionaron ramas ni se incluyó US03 en este Sprint.

## Archivos

Modificados:

- `.gitignore`: excluir bases SQLite locales.
- `backend/src/app.ts`: inyectar el repositorio de usuarios y montar las rutas sin cambiar las existentes.
- `backend/src/index.ts`: abrir SQLite y cerrar recursos al detener el servidor.
- `frontend/src/App.tsx`: envolver el simulador con la navegación de registro.

Creados (los seis archivos del módulo backend se recuperaron de la rama anterior):

- `backend/src/registration/application/RegistrationService.ts`
- `backend/src/registration/domain/User.ts`
- `backend/src/registration/domain/UserRepository.ts`
- `backend/src/registration/infrastructure/SqliteUserRepository.ts`
- `backend/src/registration/interface/UserController.ts`
- `backend/src/registration/interface/userRoutes.ts`
- `backend/tests/registration/registration.test.ts`
- `frontend/src/registration/RegistrationForm.tsx`
- `frontend/src/registration/RegistrationForm.css`
- `frontend/src/registration/RegistrationForm.test.tsx`
- `frontend/src/registration/RegistrationRoute.tsx`
- `docs/SPRINT1.md`

## Ejecutar en PowerShell

Se descargó Node.js **24.22.2 portátil** desde nodejs.org y se comprobó su SHA-256 oficial. Está en `.tools`, fuera de los cambios de las ramas. No se instaló globalmente ni se cambió el PATH permanente. Las dependencias de ambos proyectos ya están instaladas con `npm.cmd ci`, sin cambios en sus lockfiles.

Terminal 1, backend:

```powershell
$repo = 'C:\Users\Magaz_\proyecto-software2'
$env:Path = "$repo\.tools\node-v24.22.2-win-x64;$env:Path"
Set-Location "$repo\.worktrees\sprint1\backend"
npm.cmd run dev
```

Terminal 2, frontend:

```powershell
$repo = 'C:\Users\Magaz_\proyecto-software2'
$env:Path = "$repo\.tools\node-v24.22.2-win-x64;$env:Path"
Set-Location "$repo\.worktrees\sprint1\frontend"
npm.cmd run dev
```

Abre `http://localhost:5173/registro`. Backend: `http://localhost:3000`. Ejecuta un Sprint a la vez con estos puertos predeterminados. Detén con Ctrl+C antes de iniciar el otro.

SQLite crea `backend/data/usuarios.sqlite` si no existe. No está versionado. Si una base existente usa `users.id TEXT`, el arranque se detiene con un error explícito de migración requerida antes de cambiar su esquema. Para demostrar el registro nuevo sin tocar esa base, elige una ruta que todavía no exista y define `$env:USER_DB_PATH = 'ruta absoluta NUEVA a otra base.sqlite'` en la terminal del backend antes de arrancar. No reemplaces ni borres una base existente. La migración de datos reales necesita autorización posterior.

Si ya tienes Node 24 compatible en el PATH, puedes omitir la asignación temporal del PATH. Para reinstalar dependencias, usa `npm.cmd ci` dentro de cada carpeta.

## Pruebas de la entrega original, 3 y 4 de noviembre

| Verificación | Resultado real |
| --- | --- |
| Backend: `npm.cmd test` / `npm.cmd run coverage` | 78 pruebas aprobadas en 8 archivos. |
| Frontend: `npm.cmd test` | 34 pruebas aprobadas en 4 archivos. |
| Build de backend y frontend | Aprobado. |
| Lint backend | Aprobado. |
| Lint frontend: `npm.cmd run lint -- --ignore-pattern coverage` | Aprobado, sin advertencias. |
| Cobertura backend global, líneas (medición del 3/11; backend sin cambios en esta revisión) | 87,54 %. RegistrationService: 96,96 %; repositorio SQLite: 92,85 %; módulo de interfaz: 95,23 %. |
| Cobertura frontend de `src/registration/**`, repetida el 4/11 | 100 % líneas, 100 % funciones, 95,65 % ramas. |
| Servidores reales arrancados el 4/11 | Health e inicio/registro: HTTP 200; registro 201, datos inválidos 400, duplicado normalizado 409; seis peticiones concurrentes producen una alta y cinco rechazos; el duplicado persiste después de reiniciar el proceso del backend. |

Para repetir los controles, entra en cada carpeta con el PATH anterior y ejecuta:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint -- --ignore-pattern coverage
```

En backend, `npm.cmd run coverage`. En frontend, para medir el código de este Sprint:

```powershell
npm.cmd test -- --coverage '--coverage.include=src/registration/**'
```

El script habitual `npm.cmd run coverage` del frontend solo incluye `src/filters/**`; su 100 % no describe la cobertura del registro. Se respetó esa configuración existente. La exclusión de `coverage` al ejecutar lint evita advertencias de los archivos JavaScript generados por el reporte; no oculta archivos fuente.

Las pruebas del backend utilizan bases temporales y las eliminan al terminar. La prueba HTTP final usó una base nueva dentro de `.tools/review-final-zKGpmC`, con su informe `results.json`; no modificó bases de usuarios existentes ni `data/cuentas.json`. Los servidores de esa prueba se cerraron al terminar.

## Pruebas manuales pendientes en navegador

1. Abre `/registro`, envía vacío y revisa los mensajes de nombre, correo y contraseña.
2. Prueba correo inválido, contraseña de menos de 8 caracteres y confirmación diferente. No debe registrarse el usuario.
3. Completa con un correo nuevo y una contraseña de al menos 8 caracteres. Debe redirigir a `/login` con confirmación. El inicio de sesión es la dependencia US03 descrita arriba.
4. Vuelve a `/registro` e intenta el mismo correo con mayúsculas o espacios exteriores. Debe mostrar duplicidad sin abandonar el formulario.
5. Reinicia el backend y repite ese correo. Debe continuar siendo duplicado, demostrando persistencia.
6. Detén el backend y prueba otro correo válido. Debe mostrar error de conexión y permitir reintentar al reanudar el backend.
7. Vuelve al inicio y comprueba que el simulador, filtros y semáforo previos siguen disponibles.

La revisión visual del 4/11 no pudo ejecutarse: Computer Use se detuvo porque no pudo determinar con suficiente confianza la URL actual de Chrome para aplicar su política. No se continuó la automatización del navegador. Las pruebas de interacción con Testing Library/jsdom sí se ejecutaron y se ampliaron; no equivalen a una revisión visual completa. La autenticación US03 continúa siendo una dependencia fuera de estas dos historias.

## Revisar la entrega y su publicación

```powershell
Set-Location 'C:\Users\Magaz_\proyecto-software2\.worktrees\sprint1'
git branch --show-current
git status --short --untracked-files=all
git diff --check
git diff
```

Después del commit, revisa la entrega completa frente a su base y consulta su historial:

```powershell
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
git log origin/main..HEAD --oneline
git ls-remote --heads origin refs/heads/feat/sprint1-us01-us02-completo
```

La entrega original se publicó en [la rama del Sprint 1 en GitHub](https://github.com/trox-vevo/proyecto-software2/tree/feat/sprint1-us01-us02-completo). Esta referencia es histórica. La auditoría actual prohíbe nuevos commits, push y Pull Requests. Los cambios de identificadores permanecen locales.

Main y las ramas anteriores se conservan. No se autorizaron PR, merge, rebase, reset, clean ni integración con main. Para una copia nueva desde GitHub, instala Node 24 y ejecuta `npm.cmd ci` en backend y frontend; `.tools` es un recurso local excluido de Git.

## Auditoría de identificadores del 6 de noviembre de 2026

El contrato acordado por el equipo utiliza identificadores internos `number` en TypeScript e `INTEGER PRIMARY KEY` en SQLite. Se corrigió la identidad de usuarios y su representación pública. Los códigos de cuentas, instrumentos, planes y los identificadores de controles HTML conservan su significado de texto. El salt de scrypt sigue siendo criptográficamente aleatorio y no es una clave primaria.

### Contratos corregidos

| Archivo | Antes | Después |
| --- | --- | --- |
| `registration/domain/User.ts` | `User.id: string`, `PublicUser.id: string` | `id: number`; `NewUser = Omit<User, "id">` |
| `registration/domain/UserRepository.ts` | `create(user: User)` recibía una identidad | `create(user: NewUser): User` devuelve la identidad persistida |
| `registration/application/RegistrationService.ts` | `randomUUID()` antes de persistir | Datos de alta sin id; el repositorio lo asigna |
| `registration/infrastructure/SqliteUserRepository.ts` | `id TEXT PRIMARY KEY`, INSERT con id | `id INTEGER PRIMARY KEY`, INSERT sin id, lectura del resultado de SQLite |
| `registration/domain/NumericIdentifier.ts` | Sin control compartido de rango | Acepta únicamente enteros positivos exactos, valida bigint antes de convertir |
| `RegistrationForm.tsx` | Confirmaba cualquier HTTP 201 | Exige también `user.id` numérico positivo y seguro en el JSON |

El nuevo esquema para bases nuevas utiliza esta definición de identidad.

```sql
id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 9007199254740991)
```

Se conservan las columnas `username`, `email TEXT NOT NULL COLLATE NOCASE UNIQUE`, `password_hash`, `plan` y `created_at`. No se introduce AUTOINCREMENT. SQLite genera el id al omitirlo en el INSERT.

El alta usa `BEGIN IMMEDIATE`, comprueba el `lastInsertRowid` y solo confirma si el identificador cabe exactamente en el contrato `number`. La conversión de `bigint` se realiza después de comprobar el rango. Las consultas leen enteros mediante `setReadBigInts(true)` para detectar valores int64 fuera del rango seguro. Un alta que exceda el contrato se revierte. Los ids admitidos están comprendidos entre 1 y `Number.MAX_SAFE_INTEGER`, inclusive. No se convierten UUID ni cadenas numéricas con `Number` o `parseInt`.

El servicio vuelve a comprobar la identidad devuelta por el repositorio antes de formar la respuesta pública. `POST /api/users/register` conserva HTTP 201 y la estructura `{ message, user }`, con el cambio contractual de `user.id` a JSON number. El formulario exige ese formato antes de redirigir. La confirmación de contraseña continúa siendo exclusivamente una comprobación de frontend. No se cambiaron scrypt, salt, validación de contraseña, normalización de correo ni HTTP 400/409.

### Protección de bases existentes

El constructor inspecciona el esquema de usuarios antes de ejecutar DDL. Rechaza `TEXT PRIMARY KEY`, claves compuestas y claves INTEGER que no sean alias de rowid. Cierra la conexión y produce `UserSchemaMigrationRequiredError` sin migrar automáticamente. La base local observada conserva un esquema de usuario TEXT y debe mantenerse intacta hasta una migración autorizada.

El procedimiento explícito de conversión se encuentra en `backend/src/migrations`. Su ejecución real sigue pendiente de autorización. El diseño utiliza el origen en solo lectura, un respaldo consistente y una salida nuevos, conserva la correspondencia antigua/nueva en `identifier_migration_map` y valida la integridad de las relaciones. Los ensayos deben usar únicamente fixtures temporales. El procedimiento exacto y sus resultados se documentan junto con la herramienta.

Para utilizar una base nueva en una demostración, define una ruta nueva antes de arrancar el backend. Comprueba que no existe; no borres ni sustituyas la base anterior.

```powershell
$demoDirectory = Join-Path $env:TEMP ('yupay-registro-demo-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $demoDirectory | Out-Null
$env:USER_DB_PATH = Join-Path $demoDirectory 'usuarios.sqlite'
npm.cmd run dev
```

El identificador aleatorio anterior nombra una carpeta temporal de demostración. No se utiliza como clave de usuario ni se persiste como id de entidad.

### Compatibilidad futura con autenticación

US03 permanece fuera de esta corrección. El módulo de autenticación deberá admitir `User.id` y `userId` como números enteros seguros, comprobar esa identidad contra el repositorio y resolver la membresía vigente. Si una biblioteca de JWT exige `sub` textual, su adaptación se hará únicamente en ese límite y deberá validar el formato y rango de un id numérico conocido. Los tokens y credenciales continúan opacos. No debe intentarse convertir un UUID antiguo a número. Los clientes y sesiones anteriores requerirán la política de renovación o invalidación que acuerde el responsable de autenticación tras una migración autorizada.

### Pruebas específicas añadidas o adaptadas

Se actualizaron los fixtures y mocks de registro para utilizar ids asignados por SQLite. Se comprueban ids numéricos seguros en servicio, repositorio y JSON HTTP, la relectura y reapertura, asignación distinta entre usuarios y la conservación de duplicados concurrentes y hashes scrypt. Se añadieron límites bigint/number, rechazo de cadenas/UUID y enteros imprecisos, rollback al superar MAX_SAFE_INTEGER, y protección byte a byte de un fixture legacy tras el rechazo de apertura. El frontend comprueba respuesta numérica y rechaza UUID, cadenas numéricas, cero, negativos, fracciones, números imprecisos y ausencia de usuario.

### Comprobaciones de la auditoría

La suite de frontend con cobertura específica de registro pasó el 6 de noviembre de 2026 con 42 pruebas aprobadas en 4 archivos y 0 fallidas. El comando utilizado fue `npm.cmd test -- --coverage '--coverage.include=src/registration/**'`. La cobertura fue 100 % de líneas, 100 % de funciones y 96,07 % de ramas. `npm.cmd run build` y `npm.cmd run lint -- --ignore-pattern coverage` finalizaron correctamente.

Las pruebas de backend propias del registro corrigieron las expectativas anteriores de UUID y añaden los límites y protecciones descritos arriba. La ejecución final de `npm.cmd run coverage` aprobó 129 pruebas en 9 archivos, con 0 fallidas, incluyendo 42 casos de registro y 26 de migración. La cobertura global fue 90,69 % de líneas, 80,64 % de ramas y 93,39 % de funciones; el repositorio de usuarios obtuvo 97,14 % de líneas y migraciones 95,83 %. `npm.cmd run build` y `npm.cmd run lint` finalizaron correctamente. Todos los ensayos usan bases y cuentas sintéticas temporales. La base local existente no se migra ni se arranca con el nuevo repositorio durante estos controles.

Se reprodujo y corrigió un caso límite adicional: al generar el último id seguro, SQLite comprobaba el CHECK del siguiente id antes de detectar un correo duplicado concurrente y podía devolver HTTP 500. El repositorio ahora consulta el correo dentro de `BEGIN IMMEDIATE` antes del INSERT, conservando UNIQUE como defensa final. Las dos regresiones del duplicado directo y de altas HTTP concurrentes verifican el error de duplicidad y la combinación HTTP 201/409 al alcanzar el límite.

El procedimiento completo, los límites de esquemas admitidos, el respaldo, la recuperación y el comando preparado están en [MIGRACION_IDENTIFICADORES.md](MIGRACION_IDENTIFICADORES.md). Su ejecución sobre datos existentes requiere autorización posterior.
