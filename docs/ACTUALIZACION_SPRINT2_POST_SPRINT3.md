# Sprint 2 actualizado después del merge de Sprint 3

Fecha: 7 de noviembre de 2026. PR existente: https://github.com/trox-vevo/proyecto-software2/pull/11.

## Estado inicial y referencias

Origin verificado: `https://github.com/trox-vevo/proyecto-software2.git`. Main después de fetch: `505dda07e64e344fb3c400819b70c7ab2d1ca131`, con Sprint 3/PR #12 integrado. Sprint 2 local/remoto estaba limpio en `8e6e9de3a6d3dd020eab1eb3572e7dbd921efa39`; su PR estaba abierto, Ready for review y con conflictos. No había cambios locales sin publicar ni archivos sin seguimiento. No existía SQLite local en este worktree.

Se trabajó después de completar y publicar Sprint 1, conservando un checkpoint de sus archivos y HEAD para verificar que esta fase no lo alterase. Se mantuvieron los datos originales de los cuatro worktrees. Main local y Sprint 3 quedaron fuera de toda modificación.

## Conflictos exactos y causas

La simulación y el merge detectaron únicamente dos archivos con conflictos. La base común era `3baf458c3548814d4fefa9f9ffec60871dfec818`.

| Archivo | Diferencias y resolución |
| --- | --- |
| `frontend/src/App.tsx` | Sprint 2 incorporaba useCallback, estado del glosario y consultas contextuales en FinanceApp. Main añadió useEffect, CommerceApp, navegación Inicio/Planes y checkout. Se combinan imports y se mantiene `App → RegistrationRoute → CommerceApp → FinanceApp`, con perfil, glosario y ambos callbacks de tabla. |
| `frontend/src/tabla_ahorros/TablaAhorrosView.tsx` | Sprint 2 aportaba IndicadorFSD, TERMINO_POR_COLUMNA y onConsultarTermino; main aportaba FavoriteButton y favoritos. Se conservan los tres imports, las dos propiedades opcionales, ambas celdas/acciones y las consultas de cabeceras. |

Se revisaron la base común y ambas versiones. No se usó selección indiscriminada de ours/theirs.

## Comportamientos preservados

- La navegación y los callbacks de planes/checkout de main no se reemplazan por el glosario. El estado de este permanece dentro de la pantalla financiera.
- La tabla conserva estados de carga, error/reintento y vacío, ordenamiento, filtros, semáforo, FSD y favoritos. Se mantiene el colSpan de main que cuenta la columna adicional de favoritos, ahora junto a las columnas FSD.
- `onConsultarTermino` y `favoritos` siguen siendo opcionales: consumidores existentes de la tabla conservan sus contratos.
- Se mantiene el bearer de la sesión, el paywall BASICO y la autorización PRO del servidor. El pago DEMO no activa membresía ni modifica privilegios.
- Registro, recuperación, perfiles, JWT, planes, checkout y favoritos de main no se modifican manualmente en sus módulos. Los modelos y cálculos FSD, glosario, estilos, términos y metadatos anteriores de Sprint 2 se conservan sin cambios.
- No se incorpora la rama Sprint 1 dentro de Sprint 2: se integra únicamente main actualizado. La migración explícita completa del PR #10 sigue pendiente de incorporación por el líder.

## Prueba de convivencia añadida

Archivo nuevo: `frontend/src/tabla_ahorros/FsdGlosarioComercio.integration.test.tsx`.

Comprueba una misma pantalla con perfil, indicador FSD no verificado, consulta contextual FSD y retorno de foco con Escape; apertura de semáforo y colSpan coherente con las cabeceras, incluida Favoritos Pro; solicitud de favorito con bearer y parámetros originales; rechazo 403, navegación a planes, checkout y regreso al inicio; presencia final de FSD, favoritos y búsqueda del glosario, sin cambiar el plan BASICO de sesión.

Las pruebas preexistentes de Sprint 2 se conservan sin cambios de contenido. No se elimina ningún archivo de pruebas, no se relajan aserciones y no se añaden skip/todo. Los flujos heredados de main y las cuatro integraciones frontend con Express/SQLite reales también se ejecutan.

## Verificación completa

| Comando | Resultado |
| --- | --- |
| Backend `npm.cmd run coverage -- --maxWorkers=2` | 220 aprobadas, 0 fallidas, 20 archivos. |
| Backend `npm.cmd run build` | Aprobado, salida 0. |
| Backend `npm.cmd run lint` | Aprobado, salida 0. |
| Frontend `npm.cmd test -- --coverage --coverage.include=src/** --maxWorkers=2` | 189 aprobadas, 0 fallidas, 20 archivos, sin omisiones. |
| Frontend `npm.cmd run build` | Aprobado, salida 0. |
| Frontend `npm.cmd run lint -- --ignore-pattern coverage` | Aprobado, salida 0; solo se excluye el reporte generado. |

Node 24.22.2. Cobertura de líneas: backend 89,61 %, frontend 91,82 %. Se verifican FSD y sus estados, glosario/búsqueda/accesibilidad, ambas modalidades API de plazo fijo, filtros, estado vacío, perfiles, registro, autenticación, recuperación, permisos/idempotencia de favoritos, planes y checkout DEMO. Todas las ejecuciones completas finalizaron sin fallos; no se necesitaron cambios para ocultar regresiones.

Las pruebas usan cuentas y bases temporales sintéticas. No se migran datos reales, no se sobrescribe SQLite, no se envía correo real y no existen cobros bancarios. No se realizó una revisión visual en navegador real en esta actualización.

## Git, aislamiento y pendientes

Merge normal con padres `8e6e9de3a6d3dd020eab1eb3572e7dbd921efa39` y `505dda07e64e344fb3c400819b70c7ab2d1ca131`; SHA resultante consultable con `git log -1 --format="%H %P"` e identificado en el informe final. Push normal exclusivamente a `feat/sprint2-us21-us24-completo`. Se conserva el PR #11 abierto y Ready for review, sin merge ni auto-merge.

Se contrastan HEAD y hashes de main, Sprint 3 y Sprint 1 (contra su checkpoint posterior a publicar la fase anterior). Los datos originales conservan sus hashes. No se reescribe historial, no se borra ninguna rama/worktree ni se crea otro PR. La evidencia local queda fuera del envío en `.tools/post-sprint3-integration-20261107/`.

US29/US33, asociación del perfil demo, evidencia FSD real, tabla de resultados de plazo fijo, configuración productiva SMTP/JWT y migración real siguen pendientes. Una futura incorporación de otro PR a main puede requerir actualizar el restante de nuevo. Esta tarea no modifica Sprint 3: reutiliza el código que el líder ya incorporó a main.
