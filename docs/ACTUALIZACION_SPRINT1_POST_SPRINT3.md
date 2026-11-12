# Sprint 1 actualizado después del merge de Sprint 3

Fecha: 7 de noviembre de 2026. PR existente: https://github.com/trox-vevo/proyecto-software2/pull/10.

## Referencias y protección inicial

Origin verificado: `https://github.com/trox-vevo/proyecto-software2.git`. Después de fetch, `origin/main` es `505dda07e64e344fb3c400819b70c7ab2d1ca131`, que contiene el merge del PR #12. Sprint 1 local/remoto estaba en `3ce6694a05a093abf66dfecb99d687ab640029ab`, limpio, sin archivos sin seguimiento ni cambios locales pendientes. El PR #10 estaba abierto, Ready for review y con conflictos.

Se capturaron hashes de archivos y datos de los cuatro worktrees. La base SQLite local de Sprint 1 se copió a `.tools/post-sprint3-integration-20261107/sprint1-usuarios-original.backup.sqlite`, verificando igualdad de bytes mediante SHA-256. No se abrió con la aplicación ni se ejecutó una migración. No se movió, reemplazó ni sobrescribió el archivo local. Git merge se inició con `--no-overwrite-ignore`.

## Conflicto real

La simulación y el merge detectaron únicamente `backend/src/registration/infrastructure/SqliteUserRepository.ts`. La base común era `3baf458c3548814d4fefa9f9ffec60871dfec818`.

Sprint 1 había cambiado la creación a `NewUser` con transacción, control de duplicados y validación numérica segura. Sprint 3 añadió `findById(number)` junto al método create de main, para resolver identidad y plan persistido antes de guardar favoritos. Git no pudo ubicar ambos cambios en esa misma sección.

## Resolución y comportamiento conservado

- Se incorpora `findById` de main, incluyendo rechazo de IDs que no sean enteros positivos seguros y reutilización de `findByEmail` para mapear usuarios y validar planes.
- `findByEmail` mantiene lectura bigint y `numericIdentifier`, además de BASICO/PRO. Se corrige un carácter defectuoso en el mensaje de plan inválido.
- Se conserva `create(NewUser)`, `BEGIN IMMEDIATE`, comprobación de correo dentro de la transacción, UNIQUE NOCASE, ID generado por SQLite, validación de rango y rollback. La duplicidad sigue produciendo 409, incluidas concurrencia y fronteras numéricas.
- Se conservan la protección de esquemas anteriores, el procedimiento explícito de copia con respaldo y mapa, y los métodos numéricos de recuperación. No se reintroduce conversión automática de bases antiguas.
- Los módulos de favoritos, planes, checkout, composición backend y navegación frontend llegan de main sin modificaciones manuales. Las diferencias de formulario/validación que Sprint 1 ya tenía se conservan.

No se utilizó selección indiscriminada de ours/theirs. No cambia el contrato público: usuarios y referencias numéricas, sesiones opacas como string y subject JWT textual canónico. `createFavoriteUserResolver` consulta el usuario por ID y su plan actual de SQLite. No se cambia la regla de 401/403 ni se activa PRO por un pago DEMO.

## Verificaciones completas

| Comando | Resultado |
| --- | --- |
| Backend `npm.cmd run coverage -- --maxWorkers=2` | 261 aprobadas, 0 fallidas, 21 archivos. |
| Backend `npm.cmd run build` | Aprobado, salida 0. |
| Backend `npm.cmd run lint` | Aprobado, salida 0. |
| Frontend `npm.cmd test -- --coverage --coverage.include=src/** --maxWorkers=2` | 178 aprobadas, 0 fallidas, 15 archivos, sin omisiones. |
| Frontend `npm.cmd run build` | Aprobado, salida 0. |
| Frontend `npm.cmd run lint -- --ignore-pattern coverage` | Aprobado, salida 0; solo se excluye el reporte generado. |

Node 24.22.2. Cobertura de líneas: backend 91,11 %, frontend 89,71 %. Se verifican registro, correo duplicado/concurrente, scrypt, IDs seguros, persistencia/reapertura, 31 casos de migración sobre copias sintéticas, login, JWT, recuperación y permisos de favoritos. Las cuatro integraciones frontend con Express y SQLite reales se ejecutan y pasan; el pago DEMO conserva su separación de privilegios y la limpieza de campos.

Las pruebas preexistentes de Sprint 1 permanecen sin cambios de contenido. No se eliminan archivos ni se añaden skip/todo. La base local y los datos originales conservan sus hashes. La revisión de aislamiento confirma que main, Sprint 2 y Sprint 3 mantienen sus HEAD y archivos iniciales durante esta fase.

## Historial, publicación y límites

Merge normal con padres `3ce6694a05a093abf66dfecb99d687ab640029ab` y `505dda07e64e344fb3c400819b70c7ab2d1ca131`; el SHA resultante se obtiene con `git log -1 --format="%H %P"` y se informa al publicar. Push normal exclusivamente a `feat/sprint1-us01-us02-completo`. Se conserva el PR #10 abierto y Ready for review, sin merge ni auto-merge.

No se modifica main ni Sprint 3 y no se integran las ramas Sprint 1 y Sprint 2 entre sí. Esta entrega no migra datos reales, no implementa US29/US33 y no envía correos ni pagos reales. El perfil continúa siendo el demo de main. Al fusionar otro PR en main debe revisarse nuevamente el restante; no se garantiza compatibilidad futura por anticipado.

Evidencia local de aislamiento y respaldo: `.tools/post-sprint3-integration-20261107/`. Esos artefactos permanecen ignorados y fuera del envío. El reporte previo `INTEGRACION_SPRINT1_MAIN.md` describe la integración anterior; este archivo documenta la actualización posterior al PR #12.
