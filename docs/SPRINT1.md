# Sprint 1: US01 y US02

Rama: `feat/sprint1-us01-us02-completo`.
Directorio: `C:\Users\Magaz_\proyecto-software2\.worktrees\sprint1`.
Base: `origin/main`, commit `8cc91626a456e03f52f83ae5e0e143dd6e2405de`, comprobado de nuevo mediante fetch el 4 de noviembre de 2026.

La revisión final del 4 de noviembre de 2026 conserva la implementación anterior y prepara su commit exclusivo de US01/US02. La creación del commit y la publicación de esta rama fueron autorizadas expresamente por el usuario. Usa este worktree para revisar y ejecutar el Sprint. Consulta el commit de la entrega con `git log -1 --oneline` y su estado de publicación con `git status -sb`.

## Análisis y reutilización

El proyecto usa React 19, TypeScript y Vite en frontend; Express 5 y TypeScript en backend. La persistencia previa de ahorros sigue siendo `backend/data/cuentas.json` y los productos a plazo fijo siguen usando el repositorio en memoria de los compañeros.

Se revisaron las ramas remotas `origin/feat/us01-us02-registro` y `origin/feat/us21-us24-sprint2`. De la primera se reutilizaron los seis archivos de `registration`, con ajustes pequeños de composición y cierre de SQLite. El formato `scrypt$salt$hash` sigue siendo compatible con el AuthService de la rama anterior. Se conservaron UUID, plan BASICO, normalización de correo y respuestas del controlador. No se copió su archivo SQLite con usuarios ni se añadieron sus dependencias de JWT.

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

SQLite crea `backend/data/usuarios.sqlite` si no existe. No está versionado. Para elegir otra base sin modificar archivos de configuración, define `$env:USER_DB_PATH = 'ruta absoluta a otra base.sqlite'` en la terminal del backend antes de arrancar. No reemplaces una base existente.

Si ya tienes Node 24 compatible en el PATH, puedes omitir la asignación temporal del PATH. Para reinstalar dependencias, usa `npm.cmd ci` dentro de cada carpeta.

## Pruebas ejecutadas

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

Destino autorizado: [rama del Sprint 1 en GitHub](https://github.com/trox-vevo/proyecto-software2/tree/feat/sprint1-us01-us02-completo). La publicación debe usar únicamente `git push -u origin feat/sprint1-us01-us02-completo`, sin force. La confirmación de la subida y el hash final se entregan en el informe de la tarea.

Main y las ramas anteriores se conservan. No se autorizaron PR, merge, rebase, reset, clean ni integración con main. Para una copia nueva desde GitHub, instala Node 24 y ejecuta `npm.cmd ci` en backend y frontend; `.tools` es un recurso local excluido de Git.
