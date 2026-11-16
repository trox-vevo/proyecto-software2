# US21: cobertura FSD de cuentas de ahorro

Actualización del 16/11/2026. Esta entrega amplía la corrección de entidades del PR #30, ya integrado. La solicitud posterior autoriza su publicación mediante un nuevo Pull Request hacia main; su aprobación e integración definitiva quedan a cargo del líder.

## Relación y datos preservados

Se agrega `savings_account_entities(account_id, entity_id)`: clave primaria de cuenta y dos claves foráneas hacia `savings_accounts(id)` y `financial_entities(id)`. Una cuenta tiene una entidad; una entidad puede tener varias cuentas en el futuro. No se reconstruye ninguna tabla anterior ni se modifican sus columnas o filas.

| Cuenta | Entidad | Estado con la revisión actual vigente |
| --- | --- | --- |
| AH-001 | 1 — Banco de Crédito del Perú (BCP) | Verificado |
| AH-002 | 2 — BBVA Perú | Verificado |
| AH-003 | 3 — Interbank | Verificado |
| AH-004 | 4 — Scotiabank Perú | Verificado |
| AH-005 | 5 — Cooperativa Abaco | No verificado en FSD tradicional |
| AH-006 | 6 — Cooperativa Pacífico | No verificado en FSD tradicional |

La asignación explícita queda en `backend/db/savings-entity-associations.json` y en el seed para bases nuevas. No se deduce por titular, nombre parecido o posición de las filas. Los demás registros, si existen, no se asocian por suposición.

Se conservan IDs, titulares, saldos, tasas, fechas, mantenimiento, canales, productos, operaciones, usuarios y relaciones anteriores. Tampoco se cambia el JSON de las cuentas ni la columna histórica `savings_accounts.fsd_coverage`; esta última deja de ser la fuente de cobertura para el repositorio SQLite.

## Lectura y contrato

`RepositorioCuentasSqlite` hace `LEFT JOIN` desde la cuenta a la asociación y a su entidad. Recupera nombre y evidencia actual de `financial_entities` y utiliza `validarCoberturaFSD` sin debilitarlo. Una evidencia corrupta, vencida, futura, sin fuente admitida o correspondiente a otro nombre se muestra como no verificada. Una cuenta sin asociación se conserva en el resultado, sin inventar entidad o cobertura.

La identidad recorre el modelo y motor sin intervenir en las fórmulas: la respuesta de `/api/ahorros/rentabilidad` incorpora `entityId` y `entityName` cuando hay asociación, junto a los campos existentes y `coberturaFSD`. Los importes siguen usando Decimal y los mismos criterios de filtro y orden. Los consumidores anteriores que suministran cuentas sin entidad conservan sus campos de respuesta habituales.

No se copia evidencia a las cuentas: una actualización o caducidad en la entidad se refleja en la siguiente consulta. Se conservan las fechas investigadas el 15/11/2026 y el límite de revisión local del 22/11/2026. Ese límite no es una vigencia oficial; desde el 23/11/2026 la evidencia se degrada a no verificada hasta una nueva revisión manual. Las cooperativas pertenecen a un régimen FSDC distinto; no verificado en el FSD tradicional no equivale a falta de protección.

## Presentación

La tabla de ahorro conserva la columna de cuenta e incorpora «Entidad financiera». El FSD se presenta con una insignia «Verificado» o «No verificado», accesible por teclado, y enlace a la fuente cuando hay evidencia válida. Los detalles de fuente/fechas y las limitaciones financieras están en la ayuda contextual; no se agrega un banner.

Se retiran `AvisoCatalogoDemo`, su uso en `Layout` y el párrafo académico de `PlazoFijoView`, según la nueva instrucción. La variante nueva `resumen` del indicador solo se utiliza en ahorro: las variantes de alertas US35 conservan sus textos y comportamiento. El glosario US24, botones de favoritos US28, planes US31 y checkout US32 conservan sus flujos, permisos y parámetros.

### Trazabilidad técnica del catálogo

Los nombres de las seis entidades y la evidencia FSD fueron contrastados en la entrega anterior con [FSD: miembros](https://fsd.org.pe/miembros/) y [SBS: entidades autorizadas](https://www.sbs.gob.pe/app/pp/empresasweb/Paginas/EmpCaptarDep.aspx). La referencia local completa está en `backend/db/fsd-verificacion-2026-11-15.json`; esta entrega no realiza una nueva certificación ni renueva fechas.

Las cuentas y los parámetros financieros de origen se conservan como datos de demostración; la asignación a entidades reales permite probar los escenarios de US21, no acredita que esos bancos o cooperativas comercialicen esos productos, tasas o canales. Los indicadores e informes asociados también conservan sus valores originales de demostración. Esta trazabilidad queda en documentación técnica, sin presentarlos como estadísticas oficiales ni añadir avisos académicos en la interfaz. El enlace «Fuente» del indicador respalda exclusivamente la verificación FSD.

## Migración de una base existente

`scripts/link-savings-entities.mjs` funciona en modo vista previa por defecto. Para aplicar exige un respaldo nuevo, realizado con la API de backup SQLite antes de modificar el origen. El respaldo incluye WAL pendiente y se verifica por integridad y huellas de esquema/datos.

La migración abre una transacción `BEGIN IMMEDIATE`, comprueba que la fuente no cambió durante el respaldo, crea únicamente la tabla de asociación e inserta los enlaces ausentes. Comprueba claves foráneas y huellas de todas las tablas/esquemas originales, incluyendo operaciones y favoritos. Ante un error revierte la operación. Un segundo intento no duplica enlaces ni sobrescribe el respaldo.

Se detiene ante un esquema incompatible, otra asociación ya existente, una identidad de entidad diferente, triggers de asociación o relaciones inválidas. No crea cuentas/entidades faltantes ni modifica relaciones personalizadas. El respaldo solicitado nunca se sobrescribe.

El arranque inspecciona en solo lectura las bases con catálogo de ahorro antes de abrir los repositorios. Si falta la asociación o el esquema no es compatible, exige la migración manual. No convierte ni modifica silenciosamente la base al iniciar. Las bases nuevas se crean y se asocian desde schema/seed como parte de la inicialización.

No se ejecutó la migración sobre una base real durante esta entrega; todas las pruebas usan bases temporales. Para aplicarla:

```powershell
Set-Location 'C:\Users\Magaz_\proyecto-software2'
$env:Path = "C:\Users\Magaz_\proyecto-software2\.tools\node-v24.22.2-win-x64;$env:Path"

# Cerrar primero el backend y usar la ruta real de DB_PATH/USER_DB_PATH.
$dbPath = 'C:\Users\Magaz_\proyecto-software2\backend\data\usuarios.sqlite'

# Inspección sin escritura; si el archivo no existe, se detiene sin crearlo.
node scripts/link-savings-entities.mjs --database $dbPath

# Aplicación manual, con un respaldo exclusivo nuevo.
$backupPath = "$dbPath.us21-$(Get-Date -Format yyyyMMdd-HHmmss).backup.sqlite"
node scripts/link-savings-entities.mjs --database $dbPath --backup $backupPath --apply
```

Si la vista previa detecta nombres antiguos `Entidad A`…`Entidad F`, hay que aplicar primero la corrección de nombres/FSD ya documentada en `docs/CORRECCION_FSD.md`, con su propio respaldo nuevo; el actualizador de asociaciones no la ejecuta automáticamente. Si la base aún utiliza IDs UUID, corresponde primero la migración explícita documentada en `docs/MIGRACION_IDENTIFICADORES.md`. No borrar ni reinicializar la base ni ejecutar todo el seed para resolver esos avisos.

Después, reiniciar el backend con esa misma ruta de base. Las nuevas consultas y simulaciones usarán la asociación; los favoritos y operaciones guardados previamente conservan sus instantáneas históricas.

## Archivos principales

- SQL y datos de asociación: `backend/db/schema.sql`, `seed.sql`, `savings-entity-links.sql`, `savings-entity-associations.json`, y las copias SQL de `docs/BaseDeDatos`.
- Backend: `RepositorioCuentasSqlite`, modelos y formateador de rentabilidad, `SavingsEntitySchema`, `openDatabase` y la inspección inicial de `index.ts`.
- Frontend: columnas/tipos/vista de ahorro, variante y estilos del indicador FSD; retirada del aviso global y del párrafo académico de plazo fijo.
- Migración manual: `scripts/link-savings-entities.mjs`.
- Pruebas nuevas: `backend/tests/fsd/savingsEntities.test.ts`, `backend/tests/migrations/savingsEntities.test.ts`, `frontend/src/tabla_ahorros/CoberturaAhorros.test.tsx`.
- Pruebas existentes adaptadas al nuevo contrato o a las etiquetas breves: paridad de base única, `App.integration`, `Sprint2`, `FsdGlosarioComercio` y ausencia del banner en `CatalogoFSD`. Se conservan los casos y aserciones de las demás funcionalidades.

## Verificación

Las pruebas comprueban seis asociaciones y ambos estados FSD, propagación HTTP, identidad y evidencia vigentes, datos inválidos/caducados, cuentas sin asociación, preservación de fórmulas simples/compuestas y filtros/ordenamientos. La migración se prueba con respaldo, WAL, idempotencia, rollback, restricciones, vistas previas sin escrituras y conservación de tablas completas con operaciones relacionadas e importes de alta precisión.

Los resultados completos y los logs de compilación/lint quedan en `.tools/us21-ahorros-20261116/`. Se incluyen suites existentes de glosario, favoritos, planes, checkout y alertas para comprobar compatibilidad.

Resultado inicial sobre `983360c`: **520 pruebas backend y 383 frontend aprobadas, cero fallidas u omitidas**. Compilación y lint aprobados en ambos proyectos; `git diff --check` aprobado. Las verificaciones por hash confirman que los archivos de datos locales y la SQLite original del Sprint 1 no cambiaron. La aplicación real, su migración respaldada y la comprobación manual posterior están documentadas en [US21_VERIFICACION_REAL.md](US21_VERIFICACION_REAL.md).
