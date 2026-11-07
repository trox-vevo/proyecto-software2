# Resolución de conflictos de Sprint 1 y Sprint 2

Fecha: 7 de noviembre de 2026, America/Bogota. Repositorio: `trox-vevo/proyecto-software2`.

## Auditoría previa

Se verificaron las URLs de fetch y push de origin: `https://github.com/trox-vevo/proyecto-software2.git`. Después de `git fetch origin`, la referencia utilizada fue `origin/main = 3baf458c3548814d4fefa9f9ffec60871dfec818`.

| Worktree | Rama | HEAD inicial | Estado inicial |
| --- | --- | --- | --- |
| Raíz | `main` | `8cc91626a456e03f52f83ae5e0e143dd6e2405de` | Limpio; se conserva sin actualizarlo ni modificarlo. |
| `.worktrees/sprint1` | `feat/sprint1-us01-us02-completo` | `3ce6694a05a093abf66dfecb99d687ab640029ab` | Limpio y sincronizado con origin. |
| `.worktrees/sprint2` | `feat/sprint2-us21-us24-completo` | `7e361cd1b62783ea39c12b9912e09c049591d340` | Limpio y sincronizado con origin. |
| `.worktrees/sprint3` | `feat/sprint3-us28-us31-us32` | `20cbe73f9210e90e23095bcda13d11756c51dd6a` | Limpio; fuera del alcance de modificación. |

No había cambios locales de código pendientes ni archivos sin seguimiento que proteger en Sprint 1 o Sprint 2. Se capturaron los SHA y hashes de los archivos versionados y de los archivos de datos existentes de los cuatro worktrees para contrastarlos al finalizar. El inventario local se guarda en `.tools/sprint2-integration-20261107/baseline.json`, fuera del envío.

Se consultaron los PR mediante el conector y se contrastaron con la API de GitHub. Estado previo a publicar esta integración:

- PR #10: abierto, Draft, destino main, head `3ce6694`, `mergeable: true`, `mergeable_state: clean`, sin auto-merge.
- PR #11: abierto, Draft, destino main, head `7e361cd`, `mergeable: false`, `mergeable_state: dirty`, sin auto-merge. La API todavía devolvía `base.sha = 1247b9b`; la resolución se calculó expresamente con la referencia Git recién obtenida `3baf458`, no con ese SHA anterior.

## Sprint 1: comprobación sin modificaciones

La simulación `git merge-tree --write-tree --name-only --messages origin/main feat/sprint1-us01-us02-completo` no encontró conflictos. El `main` actual ya es ancestro del merge anterior del Sprint 1.

Por instrucción del usuario no se modifican archivos, no se crea otro commit, no se repiten pruebas, no se ejecuta otro merge y no se hace push redundante. Se conserva el SHA `3ce6694a05a093abf66dfecb99d687ab640029ab` y su PR existente:

https://github.com/trox-vevo/proyecto-software2/pull/10

Las verificaciones históricas de esa integración están en su propio informe `docs/INTEGRACION_SPRINT1_MAIN.md` dentro de la rama Sprint 1. No se presentan como pruebas ejecutadas nuevamente en esta tarea. Permanecen las funcionalidades US01/US02 y los cambios de autenticación, recuperación e identificadores numéricos incorporados anteriormente.

## Sprint 2: conflicto exacto y causa

La base común de Sprint 2 y main era `8cc91626a456e03f52f83ae5e0e143dd6e2405de`. La simulación y el merge real detectaron **un único archivo con conflicto de contenido**: `frontend/src/App.tsx`, con dos bloques en conflicto.

1. Main dividió el componente en `App → RegistrationRoute → FinanceApp` para incorporar las rutas de registro, login y recuperación. Sprint 2 había añadido el estado de apertura del glosario y su callback al mismo cuerpo de `App`. Se conserva la composición de rutas de main y se sitúa el estado del glosario dentro de `FinanceApp`.
2. Main añadió `ProfileEditor` debajo del título. Sprint 2 añadió allí la navegación general del glosario. Se conservan ambos elementos, primero el perfil y después el acceso al glosario.

También se revisó `frontend/src/tabla_ahorros/TablaAhorrosView.tsx`, combinado automáticamente por Git. No tenía conflicto textual: main aportaba `EmptyStateComponent` para VACIO; Sprint 2 aportaba `IndicadorFSD`, consultas contextuales y el atributo accesible de las cabeceras. Se conserva el resultado conjunto, con carga, error, reintento, ordenamiento y semáforo existentes.

No se usó selección indiscriminada de ours/theirs. Se examinaron la base común, main y Sprint 2, y se revisó el diff final frente a ambos desarrollos.

## Implementaciones conservadas

### De main

- Registro US01/US02: `backend/src/registration/application/RegistrationService.ts`, `domain/User.ts`, `domain/UserRepository.ts`, `infrastructure/SqliteUserRepository.ts`, `interface/UserController.ts` e `interface/userRoutes.ts`, bajo `backend/src/registration/`.
- Autenticación: `backend/src/auth/application/AuthService.ts`, `domain/Session.ts`, `infrastructure/InMemorySessionRepository.ts`, `interface/AuthController.ts`, `interface/authRoutes.ts`, `interface/optionalAuthMiddleware.ts` y `jwtSecret.ts`, bajo `backend/src/auth/`.
- Recuperación: servicios, contratos, adaptador SMTP y controladores/rutas de `backend/src/recovery/`, junto con las vistas `frontend/src/auth/ForgotPasswordView.tsx` y `frontend/src/auth/ResetPasswordView.tsx`.
- Login y sesión: `frontend/src/auth/LoginView.tsx`, `frontend/src/auth/session.ts`, `frontend/src/registration/RegistrationRoute.tsx`, middleware JWT y envío de bearer desde las consultas de perfil y ahorros.
- Perfil: `frontend/src/profile/ProfileEditor.tsx` y los servicios, modelo y repositorio JSON de `backend/src/profile/`.
- Filtros, ordenamiento, tabla, estado vacío US13, semáforo y monitor existentes.

Los commits de `cabrerajumi` incorporan autenticación, recuperación y la actualización numérica `3baf458`. Main también contiene los aportes de perfil/filtros de `RACG99` y el estado vacío de `renakpov`. No se atribuye todo main a un solo integrante.

### Del Sprint 2

- US21: `backend/src/fsd/CoberturaFSD.ts`, metadatos en modelos de ahorros y plazo fijo, validación al responder y `frontend/src/fsd/IndicadorFSD.tsx` con sus estilos y pruebas.
- US24: `frontend/src/glosario/GlosarioFinanciero.tsx`, `frontend/src/glosario/terminos.ts`, estilos y pruebas; búsqueda sin distinguir tildes/mayúsculas, selección, cierre, contención del foco y retorno al disparador.
- Acceso general al glosario y consultas TEA/TREA/rentabilidad/plazo fijo desde `frontend/src/App.tsx`; consultas contextuales desde las cabeceras de `frontend/src/tabla_ahorros/TablaAhorrosView.tsx`.
- `frontend/src/tabla_ahorros/columnas.ts` y `frontend/src/tabla_ahorros/tipos.ts` mantienen la columna y los datos FSD al filtrar/ordenar.
- Transporte de FSD por las APIs de ahorros y las modalidades AT_MATURITY y MONTHLY de plazo fijo; se conservan las fórmulas y montos existentes.

Las funcionalidades financieras se componen dentro de la pantalla financiera, sin ejecutar sus consultas cuando la ruta visible es registro/login. No se crea otro componente de perfil, autenticación, estado vacío o glosario para ocultar incompatibilidades.

## Contratos y datos

No se cambian las rutas ni los contratos de autenticación, recuperación, registro o perfil de main en esta integración. `User.id`, `Session.userId`, referencias de recuperación y `req.userId` mantienen los tipos numéricos de `3baf458`. El ID opaco de sesión sigue siendo string y el JWT conserva `sub: String(user.id)`.

La propiedad opcional `onConsultarTermino?: (termino: string) => void` del Sprint 2 se conserva para que consumidores existentes de la tabla sigan siendo válidos. El callback se conecta a la única instancia del glosario. No cambian los tres estados FSD: `CUBIERTO`, `NO_CUBIERTO`, `NO_VERIFICADO`.

El perfil de main sigue siendo el perfil demo independiente `usuario-demo` en JSON. No se inventa una asociación entre ese perfil y las cuentas SQLite. La cobertura sin evidencia vigente sigue mostrándose como no verificada; no se editó el catálogo para producir estados favorables.

Sprint 2 no tenía una base SQLite local. Main introducía `backend/data/usuarios.sqlite` como binario versionado. Se preservó una copia y el archivo recibido en `.tools/sprint2-integration-20261107/usuarios-main.sqlite` y `usuarios-main.original.sqlite`, comprobando sus hashes, y se retiró esa ruta del índice del Sprint 2. La regla `.gitignore` recibida de main la mantiene ignorada. No se abre ni migra esa base durante esta tarea, no se elimina su historial y no se publica el binario de ejecución.

La base local de Sprint 1 permanece en su ruta con el hash original, sin modificación. Todos los datos existentes de los otros worktrees se contrastaron con el inventario inicial. No se realizaron migraciones reales ni envíos de correo reales.

## Pruebas y correcciones de fixtures

Se modificó únicamente `frontend/src/tabla_ahorros/Sprint2.test.tsx` entre las pruebas existentes del Sprint 2 que requerían adaptación manual:

- El mock distingue GET de perfil y consulta de ahorros, porque el editor incorporado por main realiza una petición independiente.
- La comprobación de una consulta de ahorros sigue siendo exactamente una; además se comprueba una consulta de perfil y su nombre visible. No se sustituyó por un contador permisivo.
- El caso de resultados vacíos exige el encabezado `Sin resultados` de US13, conservando su acceso al glosario y cambio de instrumento.
- Se limpian la sesión y la URL al finalizar cada caso para evitar contaminación entre rutas.

Se añadió `frontend/src/App.integration.test.tsx` con dos escenarios:

1. Perfil cargado y guardado por PUT, indicador FSD, glosario contextual FSD, retorno del foco con Escape, filtro que produce estado vacío, búsqueda del glosario y restauración de resultados sin volver a consultar ahorros.
2. Registro → login → finanzas, ID numérico de sesión, almacenamiento local, bearer en perfil y ahorros, glosario, cierre de sesión hacia `/login` y retorno al inicio con perfil y FSD.

La primera ejecución frontend tuvo 65 aprobadas y un fallo en el escenario nuevo: esperaba incorrectamente que cerrar sesión permaneciera en la pantalla financiera. Se corrigió la prueba para exigir la redirección a `/login` que main ya implementaba y luego volver al inicio mediante su enlace. No se cambió código de producción para forzar ese resultado. La segunda ejecución completa aprobó los 66 casos.

No se eliminó ningún archivo de pruebas de main ni del Sprint 2, y no se añadieron skip/todo. Las pruebas existentes de main se conservaron, salvo las adaptaciones de fixtures numéricos de `backend/src/rentabilidad/MotorCalculo.test.ts` y `backend/tests/simulation/interface/SimulationController.test.ts` que ya pertenecían al commit original del Sprint 2. `frontend/src/App.test.tsx` y `frontend/src/filters/resultFilters.test.ts` reciben las actualizaciones de main sin modificarlas manualmente.

### Resultados finales ejecutados

Entorno: Node 24.22.2, dependencias del lockfile instalado mediante `npm.cmd ci` en el backend de Sprint 2. Las pruebas usan fixtures y bases sintéticas temporales; Testing Library/jsdom comprueba la interacción frontend.

| Directorio | Comando | Resultado |
| --- | --- | --- |
| `backend` | `npm.cmd run coverage -- --maxWorkers=2` | 117 aprobadas, 0 fallidas, 14 archivos. |
| `backend` | `npm.cmd run build` | Código de salida 0. |
| `backend` | `npm.cmd run lint` | Código de salida 0. |
| `frontend` | `npm.cmd test -- --coverage --coverage.include=src/** --maxWorkers=2` | 66 aprobadas, 0 fallidas, 12 archivos. |
| `frontend` | `npm.cmd run build` | Código de salida 0. |
| `frontend` | `npm.cmd run lint -- --ignore-pattern coverage` | Código de salida 0; solo se excluye el reporte generado. |

Cobertura: backend 87,52 % de líneas y 76,21 % de ramas; frontend 87,11 % de líneas y 79,41 % de ramas. `CoberturaFSD.ts` alcanza 94,44 % de líneas y 97,36 % de ramas; glosario frontend, 100 % de líneas. La cobertura global no equivale a cobertura exhaustiva de todos los recorridos.

El backend verifica evidencia FSD, degradación segura de metadatos inválidos, transporte sin alterar importes y ambas modalidades de plazo fijo. Las suites recibidas de main verifican registro, duplicados, SQLite, planes, JWT, recuperación, SMTP simulado y perfil JSON/API. El frontend verifica FSD, búsqueda y accesibilidad del glosario, navegación, autenticación/sesión, perfiles, filtros y estado vacío.

No se realizó una revisión visual en navegador real en esta tarea ni una auditoría completa de Sprint 3. Los resultados anteriores son pruebas automatizadas y compilación/lint, no afirmaciones de validación manual exhaustiva.

## Historial y publicación permitida

La resolución se documenta con un merge normal de dos padres: Sprint 2 en `7e361cd1b62783ea39c12b9912e09c049591d340` y main en `3baf458c3548814d4fefa9f9ffec60871dfec818`. El SHA resultante se obtiene con `git log -1 --format="%H %P"`; no se reescribe ningún commit.

Solo se publica la rama `feat/sprint2-us21-us24-completo` mediante push normal. El PR existente es https://github.com/trox-vevo/proyecto-software2/pull/11, con destino main y abierto para revisión. El informe final de la tarea y la consulta posterior a GitHub indican el SHA publicado y la mergeabilidad efectiva después del push. No se crean PR nuevos ni se fusionan los existentes.

## Dependencias y pendientes

- PR #10 y PR #11 siguen sujetos a revisión del líder. Esta tarea no incorpora las correcciones del PR #10 dentro de main ni mezcla su rama con Sprint 2. En particular, Sprint 2 conserva la implementación de registro y migración de `origin/main`; la política de copia explícita y las protecciones adicionales del PR #10 siguen pendientes de incorporación por el equipo. Antes de trabajar con bases antiguas hay que revisar ese orden de integración; no se probaron datos reales.
- El perfil JSON sigue siendo demo. Vincularlo al usuario autenticado requiere una decisión de producto; se conserva el comportamiento del equipo.
- No hay evidencia FSD real añadida al catálogo: los datos actuales continúan no verificados. Los estados confirmados proceden exclusivamente de fixtures ficticios.
- El transporte FSD a plazo fijo está comprobado por API en ambas modalidades; la pantalla existente de plazo fijo todavía no conecta una tabla de resultados. No se implementa otra historia para suplirla.
- SMTP real y JWT_SECRET de producción requieren configuración externa. Las pruebas no envían correos reales.
- Como riesgo de integración futura, Sprint 3 también modifica `backend/src/app.ts`, `backend/src/index.ts`, `frontend/src/App.tsx` y `frontend/src/tabla_ahorros/TablaAhorrosView.tsx`. Se comprobó únicamente esa coincidencia de rutas mediante Git; no constituye un diagnóstico de conflictos resueltos ni una auditoría de Sprint 3. No se modificó ni intentó integrar su funcionalidad.
- Cualquier cambio posterior de main puede requerir una actualización nueva de estos PR. La ausencia de conflictos se refiere a los SHA verificados en esta entrega.

## Comandos para auditoría posterior

Desde `.worktrees/sprint2`:

```powershell
git remote -v
git log -1 --format="%H %P"
git status --short --branch
git diff 7e361cd1b62783ea39c12b9912e09c049591d340..HEAD --stat
git diff 3baf458c3548814d4fefa9f9ffec60871dfec818..HEAD
git ls-files -u
git ls-remote origin refs/heads/main refs/heads/feat/sprint1-us01-us02-completo refs/heads/feat/sprint2-us21-us24-completo refs/heads/feat/sprint3-us28-us31-us32
```

Los snapshots y scripts de comprobación locales están en `.tools/sprint2-integration-20261107/`; quedan ignorados y no contienen credenciales. El registro final de GitHub guarda únicamente metadatos de los PR. Las credenciales utilizadas para consultar/actualizar el PR permanecen en memoria y no se imprimen ni se escriben en esos archivos.
