# Integración de Sprint 3 con main — 7 de noviembre de 2026

Repositorio: `trox-vevo/proyecto-software2`. Rama autorizada: `feat/sprint3-us28-us31-us32`. Worktree: `.worktrees/sprint3`. PR existente: https://github.com/trox-vevo/proyecto-software2/pull/12.

## Auditoría inicial

Se comprobó origin (`https://github.com/trox-vevo/proyecto-software2.git`) y se ejecutó `git fetch origin`. Main actualizado: `3baf458c3548814d4fefa9f9ffec60871dfec818`. Sprint 3 local y remoto coincidían en `20cbe73f9210e90e23095bcda13d11756c51dd6a`; el worktree estaba limpio y no había archivos sin seguimiento ni cambios de código locales pendientes.

La base común era `8cc91626a456e03f52f83ae5e0e143dd6e2405de`. El PR #12 estaba abierto, Draft y con conflictos. Los SHA iniciales de los otros worktrees fueron:

- Main local: `8cc91626a456e03f52f83ae5e0e143dd6e2405de`; no se actualiza ese worktree.
- Sprint 1: `3ce6694a05a093abf66dfecb99d687ab640029ab`.
- Sprint 2: `8e6e9de3a6d3dd020eab1eb3572e7dbd921efa39`.

Se capturaron hashes de archivos versionados y de datos existentes para contrastar el aislamiento al finalizar. Los snapshots y scripts quedan en `.tools/sprint3-integration-20261107/`, fuera de Git.

## Conflictos exactos y resolución

La simulación Git y el merge real detectaron exactamente tres conflictos de contenido:

| Archivo | Main | Sprint 3 | Combinación |
| --- | --- | --- | --- |
| `backend/src/app.ts` | Registro, autenticación, recuperación, middleware JWT, perfil y errores de perfil. | Rutas de planes, checkout y favoritos e inyección de dependencias. | Se conservan todas las rutas y errores. El JWT se verifica antes de favoritos. Se mantienen las llamadas existentes de ambos desarrollos y se añade un argumento para combinarlos. |
| `backend/src/index.ts` | Repositorio de usuarios y recuperación y adaptador SMTP. | Repositorio/servicio de favoritos con autenticación aún sin conectar. | Se usa un único archivo SQLite, inicializando primero usuarios y después favoritos. Se conectan las dependencias reales, se verifica el esquema antes de abrir repositorios y se cierran ambas conexiones al detenerse. |
| `frontend/src/App.tsx` | Rutas de registro/login/recuperación y editor de perfil. | Navegación Inicio/Planes, checkout y botones de favoritos. | `App → RegistrationRoute → CommerceApp`, con `FinanceApp` y perfil en el inicio. Se mantienen planes/checkout y callbacks de favoritos, historial y retorno al inicio. |

No se seleccionaron ours/theirs indiscriminadamente. Se revisaron la base común y ambas implementaciones. `frontend/src/tabla_ahorros/TablaAhorrosView.tsx` y `frontend/src/tabla_ahorros/useTablaAhorrosController.ts` se combinaron automáticamente y se revisaron: mantienen favoritos, días de simulación, bearer, ordenamiento, filtros, semáforo y estado vacío US13.

Los aportes de main incluyen los commits de `cabrerajumi` de autenticación, recuperación y contrato numérico, los perfiles/filtros de `RACG99` y el estado vacío de `renakpov`. Se conservan los módulos de esos compañeros; no se atribuyen todos a una sola persona.

## Conexión de identidad y autorización de favoritos

El Sprint 3 anterior devolvía 401 en su arranque porque `resolveUser` no estaba conectado. La integración reutiliza la identidad ya verificada por `optionalAuthMiddleware`:

1. Main verifica la firma y vencimiento del JWT y valida su subject numérico canónico.
2. `backend/src/favorites/infrastructure/createFavoriteUserResolver.ts` exige `req.userId` como entero positivo seguro y consulta la cuenta persistida.
3. `backend/src/registration/infrastructure/SqliteUserRepository.ts` añade `findById(number)`. Reutiliza el mapeo y la validación de planes existentes de `findByEmail`, sin duplicar un modelo de usuario ni cambiar la interfaz de los adaptadores existentes.
4. El resolver devuelve el ID y el plan actual de SQLite. No confía en el plan de localStorage, del cuerpo, de cabeceras ni de un claim JWT.
5. Las reglas de `createFavoriteRouter` y `FavoriteService` permanecen: 401 sin identidad válida, 403 si no es PRO, y guardado idempotente con IDs numéricos para PRO.

El cambio de plan persistido se aplica en la siguiente petición aunque se reutilice el mismo JWT. Un usuario inexistente tampoco obtiene acceso por presentar un JWT con un subject positivo. No se crean identidades artificiales ni se añade autenticación de demostración al arranque productivo.

`frontend/src/commerce/FavoriteButton.tsx` reutiliza `fetchWithAuth` de main. Conserva cancelación, doble envío, mensajes, idempotencia y acceso al paywall; actualiza el texto de 401 para no afirmar que la integración de cuenta sigue pendiente.

La pasarela DEMO y US33 siguen separados: aprobar una simulación no cambia el plan, no activa membresía ni autoriza favoritos a BASICO. Se usa el plan persistido que main ya define; no se inventan precios, suscripciones, vigencias o cobros reales.

## Contratos conservados

- `createApp(products, dependencies)` sigue aceptando las dependencias históricas Sprint 3.
- Las llamadas de main con usuario o perfil en el segundo argumento y recuperación/perfil en los siguientes permanecen válidas.
- La composición integrada usa `createApp(products, users, recoveryTokens, emailService, profileRepository, sprint3Dependencies)`. Los tests de ambos desarrollos se conservan para comprobar esa compatibilidad.
- `User.id`, `Session.userId`, las referencias de recuperación y los IDs de favoritos/propietarios siguen siendo numéricos. El ID opaco de sesión y el subject textual canónico JWT mantienen el contrato de main.
- No se cambian los contratos de planes, checkout, facturación, escenarios DEMO, parámetros de simulación ni códigos de cuentas.
- `backend/src/favorites/application/FavoriteService.ts`, `domain/Favorite.ts`, `infrastructure/SqliteFavoriteRepository.ts`, los módulos de checkout/planes y `Checkout.tsx`, `demoCards.ts` y `PlanComparison.tsx` conservan su implementación anterior.

## Protección de SQLite

La conversión automática de IDs TEXT del repositorio heredado de main solo conoce usuarios y recuperación; no contempla favoritos. Invocarla al arrancar una base con favoritos podría dejar relaciones sin actualizar. Se conserva la decisión previa del usuario de exigir migración explícita con respaldo mediante una inspección anterior a la apertura de repositorios.

`backend/src/favorites/infrastructure/assertNumericDatabase.ts` abre la fuente existente en modo de solo lectura y comprueba IDs y referencias en usuarios, favoritos y recuperación. Rechaza TEXT, PK que no sean alias rowid y relaciones sin tabla de usuarios. No crea bases durante la inspección ni fabrica propietarios. El punto de entrada lo ejecuta antes del constructor de usuarios.

Alcance preciso: esta protección corresponde al arranque integrado `index.ts`. El constructor heredado de main conserva su comportamiento interno y las pruebas de migración que ya tenía; no se presenta como una herramienta segura para migrar bases con favoritos. Una ejecución manual o una composición externa debe respetar la inspección y el procedimiento explícito. No se ejecutó ninguna migración sobre datos existentes.

Sprint 3 no tenía SQLite local. El binario versionado que llegó de main se respaldó en `.tools/sprint3-integration-20261107/usuarios-main.sqlite` y `usuarios-main.original.sqlite`, verificando igualdad de hashes; se retiró del índice. La ruta permanece ignorada por `.gitignore`. No se publica el binario de ejecución y el archivo de main permanece recuperable en su historial y respaldos.

Las bases y los datos preexistentes de los otros worktrees permanecen intactos. No se modifica la base UUID local de Sprint 1. No se suben secretos, `.env`, dependencias, cobertura ni temporales.

## Pruebas nuevas y conservación de las existentes

Se añaden:

- `backend/tests/sprint3/mainAuth.integration.test.ts`: HTTP real con JWT, repositorio de usuarios, recuperación y favoritos en SQLite. Registro y duplicado, login BASIC/PRO, 401 anónimo/inválido/expirado/cuenta inexistente, 403 BASIC, rechazo de plan falsificado, guardado 201 y reintento 200, IDs numéricos, degradación inmediata del plan persistido, pago DEMO sin privilegios, recuperación y login con nueva contraseña, token de un solo uso y coexistencia de perfil/planes.
- `backend/tests/sprint3/databaseStartup.test.ts`: base ausente sin creación, rechazo de esquemas TEXT/PK no rowid/referencias TEXT y ausencia de usuarios, comprobando que los bytes originales permanecen intactos.
- `frontend/src/commerce/MainSession.integration.test.tsx`: login de main, bearer al guardar favorito, perfil visible, navegación planes/checkout/registro y limpieza de campos ficticios de tarjeta al desmontar y reabrir checkout. No se envía ningún pago en ese recorrido.

La única adaptación manual a una prueba preexistente es el mock de GET perfil en `frontend/src/commerce/Sprint3App.test.tsx`. Sus aserciones de favoritos/paywall/navegación se conservan. `frontend/src/App.test.tsx` y `frontend/src/filters/resultFilters.test.ts` reciben los cambios de main sin alterarlos manualmente.

No se elimina ningún archivo de pruebas de ninguna de las dos ramas. Las pruebas preexistentes de main se mantienen sin cambios de contenido, comprobadas normalizando únicamente finales de línea. No se añaden skip/todo ni se relajan aserciones para obtener resultados favorables.

## Resultados ejecutados

Entorno: Node 24.22.2; dependencias backend del lockfile de main instaladas mediante `npm.cmd ci`. Se usan exclusivamente cuentas y bases temporales sintéticas.

| Directorio | Comando | Resultado final |
| --- | --- | --- |
| Backend | `npm.cmd run coverage -- --maxWorkers=2` | 202 aprobadas, 0 fallidas, 19 archivos. |
| Backend | `npm.cmd run build` | Salida 0. |
| Backend | `npm.cmd run lint` | Salida 0. |
| Frontend | `npm.cmd test -- --coverage --coverage.include=src/** --maxWorkers=2` | 170 aprobadas, 0 fallidas, 15 archivos, sin pruebas omitidas. |
| Frontend | `npm.cmd run build` | Salida 0. |
| Frontend | `npm.cmd run lint -- --ignore-pattern coverage` | Salida 0; solo se excluye el reporte generado. |

Cobertura de líneas: backend 89,43 %, frontend 89,62 %. Comercio frontend conserva 100 % de líneas y 95,52 % de ramas. La cobertura global no equivale a validación exhaustiva de todos los recorridos.

Las cuatro integraciones existentes de React con Express y SQLite reales permanecen incluidas y aprobadas. Comprueban pago aprobado/rechazado, reintento, navegación y conservación de 401/403 tras una aprobación ficticia. Se conservan además todas las validaciones de tarjeta ficticia, no transmisión de sus datos y limpieza al terminar, abandonar o recibir pagehide.

La primera ejecución frontend encontró el mock de perfil incompleto y una restricción de Node/tsx en el sandbox (`uv_os_get_passwd`, ENOMEM) al iniciar el fixture. Se completó el mock y se repitió la suite con permisos de ejecución adecuados; las cuatro integraciones se ejecutaron, no se omitieron. También se corrigió un parámetro de prueba sin uso señalado por lint. La ejecución final completa aprobó pruebas, build y lint.

No se hizo una revisión visual en navegador real ni se enviaron correos reales. Las verificaciones reportadas son automatizadas, incluyendo HTTP/SQLite reales y Testing Library/jsdom.

## Git y publicación

El merge conserva como padres Sprint 3 en `20cbe73f9210e90e23095bcda13d11756c51dd6a` y main en `3baf458c3548814d4fefa9f9ffec60871dfec818`, sin rebase ni reescritura. El SHA final se consulta con `git log -1 --format="%H %P"` y se identifica en el informe final de la tarea y los metadatos del PR después del push.

Destino exclusivo de publicación: `feat/sprint3-us28-us31-us32`, mediante push normal, actualizando el PR #12 existente. No se crea otro PR, no se fusiona, no se activa auto-merge y no se modifican main, Sprint 1 o Sprint 2. La consulta posterior a GitHub debe verificar head publicado, destino main y ausencia de conflictos.

## Pendientes y futuras integraciones

- La migración real y la renovación de sesiones/JWT anteriores requieren coordinación y autorización. La herramienta del PR #10 debe revisarse e incorporarse por el equipo; no se fusiona esa rama dentro de Sprint 3.
- El registro y el resto de protecciones numéricas adicionales del PR #10 siguen sujetos a revisión del líder. Esta rama solo añade al repositorio de main la búsqueda necesaria para favoritos y protege el arranque.
- US33 sigue pendiente para asociar resultados DEMO y suscripciones/activación autorizada. Un usuario nuevo continúa BASICO; no hay un mecanismo de ascenso inventado en esta entrega.
- US29 sigue pendiente para historial/gestión de favoritos. No se añaden sus endpoints.
- El perfil JSON sigue siendo demo e independiente del usuario registrado. Se conserva la funcionalidad del equipo, sin inventar una asociación.
- Precios comerciales, cobros reales y credenciales de proveedores no se incorporan. SMTP/JWT de producción necesitan configuración externa.
- Sprint 1 y Sprint 2 siguen independientes, con sus commits y datos intactos. Al incorporar sus PR a main habrá que revisar de nuevo la composición de `App.tsx`, tabla, bootstrap y repositorio de usuarios. Que los PR sean compatibles con el main actual no garantiza que sus combinaciones futuras carezcan de conflictos.
- No se incorporan FSD/glosario desde la rama Sprint 2: todavía no están en el main utilizado y esta tarea integra main, no las tres ramas entre sí.

## Comprobaciones reproducibles

Desde `.worktrees/sprint3`:

```powershell
git remote -v
git log -1 --format="%H %P"
git status --short --branch
git ls-files -u
git diff 20cbe73f9210e90e23095bcda13d11756c51dd6a..HEAD --stat
git diff 3baf458c3548814d4fefa9f9ffec60871dfec818..HEAD
git ls-remote origin refs/heads/main refs/heads/feat/sprint1-us01-us02-completo refs/heads/feat/sprint2-us21-us24-completo refs/heads/feat/sprint3-us28-us31-us32
```

El contraste local de aislamiento se guarda en `.tools/sprint3-integration-20261107/verify-isolation.py` y su inventario inicial `baseline.json`. Los metadatos posteriores del PR contienen los SHA y la mergeabilidad efectiva. Ninguno de esos artefactos locales almacena credenciales.
