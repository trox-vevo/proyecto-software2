# Corrección de datos FSD — US21 y US35

Implementación inicial preparada el 15/11/2026 sobre `origin/main` en `f823cf1`, en la rama `codex/correccion-fsd-entidades-reales`. La solicitud posterior autoriza publicar esta corrección mediante un Pull Request hacia main; la integración definitiva queda a cargo del líder. Las ramas de los tres sprints y la referencia local de main se conservan.

## Entidades y evidencia

Se consultaron las fuentes oficiales el **15/11/2026**:

- [FSD: miembros](https://fsd.org.pe/miembros/): relación que respalda los ocho bancos/caja solicitados, con nombres comerciales equivalentes indicados en el archivo de verificación.
- [SBS: entidades autorizadas](https://www.sbs.gob.pe/app/pp/empresasweb/Paginas/EmpCaptarDep.aspx): identifica las COOPAC y distingue su régimen FSDC del FSD tradicional.
- [SBS: detalle de entidades en Lima](https://www.sbs.gob.pe/app/pp/empresasweb/Paginas/EmpCaptarDepRegDet.aspx?coddpto=15&nombre=Lima): comprobación complementaria de cobertura de los bancos seleccionados.
- [FSD: alcance de cobertura](https://fsd.org.pe/cobertura/): la participación no significa cobertura ilimitada de cualquier depósito o titular.

| Nombre solicitado | Verificación FSD tradicional | Fila utilizada |
| --- | --- | --- |
| Banco de Crédito del Perú (BCP) | Sí; `CUBIERTO` | ID 1, antes Entidad A |
| BBVA Perú | Sí; `CUBIERTO` | ID 2, antes Entidad B |
| Interbank | Sí; `CUBIERTO` | ID 3, antes Entidad C |
| Scotiabank Perú | Sí; `CUBIERTO` | ID 4, antes Entidad D |
| Banco Pichincha | Sí; documentado | Sin fila nueva |
| Banco Falabella | Sí; documentado | Sin fila nueva |
| Mibanco | Sí; documentado | Sin fila nueva |
| Caja Arequipa | Sí; documentado | Sin fila nueva |
| Cooperativa Abaco | `NO_VERIFICADO` | ID 5, antes Entidad E |
| Cooperativa Pacífico | `NO_VERIFICADO` | ID 6, antes Entidad F |
| Cooperativa Santa María Magdalena | `NO_VERIFICADO`; documentado | Sin fila nueva |
| Cooperativa San Martín de Porres | `NO_VERIFICADO`; documentado | Sin fila nueva |

El catálogo solo contiene seis entidades y seis productos relacionados. Se priorizó conservar sus filas, IDs y relaciones y representar los dos escenarios. Las doce identidades y sus fuentes quedan guardadas localmente en `backend/db/fsd-verificacion-2026-11-15.json`; no se inventaron seis productos adicionales ni se duplicaron identidades. La selección de cuatro bancos y dos cooperativas es una asignación académica, no una correspondencia histórica con los productos ficticios.

`true` se traduce al estado existente `CUBIERTO`. `false` se traduce a `NO_VERIFICADO`, **no a `NO_CUBIERTO`**. Las cooperativas no aparecen en la relación consultada de miembros del FSD tradicional y tienen un régimen distinto, FSDC; no se ha certificado aquí su cobertura individual en dicho fondo. La ausencia en una lista no demuestra ausencia de protección.

## Fechas y datos de demostración

`fechaVerificacion` registra la consulta del 15/11/2026. El validador exige una fecha final para aceptar evidencia: se utiliza una **política local de revisión de siete días**, hasta el 22/11/2026 inclusive. `vigenteHasta` es ese límite técnico de revisión, no una caducidad oficial del seguro. Las cooperativas conservan `vigenteHasta: null` y estado no verificado.

No se modificó `validarCoberturaFSD`. La evidencia futura, vencida, mal formada o con fuente no admitida sigue degradándose a `NO_VERIFICADO`. A partir del 23/11/2026 los bancos también se mostrarán no verificados hasta realizar otra consulta y actualizar manualmente la evidencia; no se renuevan las fechas al arrancar.

El usuario autorizó expresamente conservar tasas, canales, calificaciones e informes ficticios bajo nombres reales, con un aviso visible. El aviso común explica esta separación y el régimen FSDC. La tabla de plazo fijo ahora muestra el indicador FSD que la API ya devolvía. La fecha del indicador se presenta como revisión de evidencia, evitando llamarla vigencia oficial.

No se adjudicó una entidad a las cuentas de ahorro: `savings_accounts` no tiene relación con `financial_entities` y sus titulares son personas. Inventar esa asociación habría requerido cambiar el modelo o los datos. Sus valores y cobertura permanecen intactos; US21 puede demostrar ambos estados en el catálogo de plazo fijo y US35 en las alertas de entidad.

## Archivos y campos modificados

- `backend/db/seed.sql` y `docs/BaseDeDatos/seed.sql`: solo `financial_entities.name`, `fsd_coverage` y comentarios. Se eliminan las antiguas evidencias ficticias. Ambas copias quedan sincronizadas.
- `backend/db/fsd-verificacion-2026-11-15.json`: nueva referencia local de las doce entidades, nombres en las fuentes, consulta y política de revisión.
- `backend/data/sbs.json` y `backend/data/informes.json`: solo `entityName`, para mantener consistentes los lectores JSON alternativos. Los indicadores e informes siguen siendo demostraciones.
- `backend/src/simulation/infrastructure/InMemoryProductRepository.ts`: adapta nombres y FSD de su catálogo alternativo a esa misma referencia, conservando parámetros, tasas y canales.
- `frontend/src/fsd/AvisoCatalogoDemo.tsx` y `frontend/src/app/Layout.tsx`: aviso visible autorizado, común a simulaciones y alertas.
- `frontend/src/fsd/IndicadorFSD.tsx`: texto de la fecha de revisión, con validaciones sin cambios.
- `frontend/src/plazo_fijo/PlazoFijoView.tsx`, `tipos.ts` y `TablaResultadosPlazoFijo.tsx`: explicación de nombres reales/datos ficticios y presentación del FSD recibido en la respuesta existente.
- `scripts/update-fsd-catalog.mjs`: herramienta manual de actualización con vista previa y respaldo obligatorio.
- Nuevas pruebas: `backend/tests/fsd/catalog.test.ts`, `catalog-baseline.json`, `updateCatalog.test.ts` y `frontend/src/fsd/CatalogoFSD.test.tsx`.
- Pruebas existentes adaptadas únicamente al nombre nuevo o a la columna FSD: `backend/tests/alertas/alertasApi.test.ts`, `sqliteResolvedorAlertaCorreo.test.ts`, `backend/tests/risk/economistReport.integration.test.ts` y `frontend/src/plazo_fijo/TablaResultadosPlazoFijo.test.tsx`. No se eliminaron aserciones ni pruebas.

## Preservación y comprobaciones

Se mantienen exactamente los IDs, claves foráneas, saldos, tasas, montos mínimos, productos, departamentos, canales, fechas de operaciones, usuarios y contenidos de riesgo/informes. No hay cambios de esquema ni dependencias, ni nuevas conexiones externas. Los repositorios de alertas, autenticación, pagos y suscripciones no se modificaron.

Las nuevas pruebas comparan hashes fijados con el seed original de `f823cf1` de las cinco tablas, excluyendo únicamente nombre/FSD en `financial_entities`. También comparan los JSON sin `entityName`. Esto comprueba valores completos, no solo cantidades de filas. `PRAGMA foreign_key_check` pasa en el catálogo nuevo.

La actualización manual se probó exclusivamente en bases temporales: vista previa sin cambios de bytes, respaldo consistente, conservación del esquema y operaciones relacionadas, reintento idempotente, ausencia de filas sin rellenarlas y rechazo de nombres/evidencias personalizados, colisiones y triggers. Nunca sobreescribe un respaldo existente. No se ejecutó sobre datos reales ni se reinicializó ninguna base.

Resultados finales:

| Comprobación | Resultado |
| --- | --- |
| Backend completo | 488 aprobadas, 0 fallidas, 0 omitidas |
| Frontend completo | 373 aprobadas, 4 fallidas, 0 omitidas |
| Frontend específico FSD/alertas/tabla | 36 aprobadas, 0 fallidas |
| Compilación backend y frontend | Aprobada |
| Lint backend y frontend | Aprobado; solo se excluye cobertura generada |
| Sintaxis del actualizador y `git diff --check` | Aprobados |

Los cuatro fallos de frontend se reprodujeron también en una copia intacta de `f823cf1` (369 aprobadas, los mismos cuatro fallos). Corresponden a dos casos de `App.integration.test.tsx`, uno de `commerce/MainSession.integration.test.tsx` y uno de `tabla_ahorros/FsdGlosarioComercio.integration.test.tsx`: esperan el botón «Volver al inicio», retirado en la navegación actual. No se cambió esa funcionalidad ni se debilitó su prueba para ocultarlos. Por ello no se afirma que la suite completa esté totalmente aprobada.

Evidencias locales: `.tools/fsd-real-20261115/backend-final.json`, `frontend-final.json`, `frontend-baseline.json` y logs de compilación/lint. Los hashes confirman que los otros worktrees y la base SQLite original del Sprint 1 permanecen intactos. El checkout inicial de main era antiguo; los cambios de catálogo previos de main se recibieron al crear la rama desde `f823cf1`, no forman parte de esta corrección.

## Aplicación manual a una base existente

Cerrar primero el backend. Usar Node 24 compatible y la ruta **real** configurada mediante `DB_PATH` o, por compatibilidad, `USER_DB_PATH`. Los comandos se ejecutan desde la raíz del proyecto y no necesitan instalar dependencias nuevas:

```powershell
Set-Location 'C:\Users\Magaz_\proyecto-software2'
$env:Path = "C:\Users\Magaz_\proyecto-software2\.tools\node-v24.22.2-win-x64;$env:Path"

# Sustituir por la base existente que realmente utiliza el backend.
$dbPath = 'C:\Users\Magaz_\proyecto-software2\backend\data\usuarios.sqlite'

# Vista previa: abre en solo lectura; no crea una base si la ruta no existe.
node scripts/update-fsd-catalog.mjs --database $dbPath

# Tras revisar la vista previa, aplicar con un respaldo NUEVO.
$backupPath = "$dbPath.fsd-$(Get-Date -Format yyyyMMdd-HHmmss).backup.sqlite"
node scripts/update-fsd-catalog.mjs --database $dbPath --backup $backupPath --apply
```

El actualizador solo cambia `financial_entities.name` y `fsd_coverage` de los IDs previstos que existan. Detiene la operación si encuentra una asociación personalizada, evidencia distinta a la anterior conocida, un nombre duplicado o triggers. El respaldo usa la API de backup SQLite y se verifica antes de escribir. Las escrituras se hacen en una transacción con comprobación de integridad referencial; un cambio concurrente del catálogo obliga a revisar de nuevo.

Editar el seed no actualiza por sí solo una base existente: `INSERT OR IGNORE` conserva sus filas. No volver a ejecutar todo el seed para corregirla. El script no actualiza favoritos históricos ni instantáneas guardadas; hacerlo alteraría operaciones previas. Tampoco envía correos ni crea eventos de mercado: las alertas existentes consultan la identidad/FSD actuales sin cambiar el contenido de su evento.
