# Procedimiento de copia con identificadores numéricos

Fecha de preparación y pruebas: 6 de noviembre de 2026.

## Estado de autorización

La herramienta está implementada y se probó únicamente con bases sintéticas temporales. Su ejecución sobre una base existente del usuario requiere autorización posterior. No se ha ejecutado sobre `backend/data/usuarios.sqlite` ni sobre los archivos anteriores de `.tools`.

La fuente siempre se abre en modo de solo lectura. El procedimiento produce un respaldo consistente y una base de salida nuevos. Nunca transforma la fuente en su lugar, nunca elimina una base ni sustituye un destino existente. El cambio de la aplicación a la nueva base también queda pendiente de revisión y autorización.

## Archivos y contrato

- `backend/src/migrations/NumericIdentifierMigration.ts` implementa el procedimiento.
- `backend/src/migrations/migrateNumericIdentifiers.ts` proporciona el CLI.
- `backend/tests/migrations/numericIdentifiers.test.ts` contiene 26 casos de prueba.

El esquema de destino conserva los campos de usuarios y favoritos. Las claves internas son `INTEGER PRIMARY KEY`, y `favorite_simulations.user_id` es `INTEGER` con referencia a `users(id) ON DELETE CASCADE`. El contrato de aplicación admite exclusivamente enteros positivos hasta `9007199254740991`, representables exactamente como `number`.

SQLite genera los identificadores nuevos cuando la fuente utiliza claves TEXT. Los identificadores INTEGER válidos existentes conservan su valor. No se convierte ningún UUID mediante `Number`, `parseInt`, hashes numéricos, timestamps o contadores locales.

La tabla `identifier_migration_map` conserva `entity`, `legacy_id` y `numeric_id`. La combinación de entidad y clave anterior es primaria, y la combinación de entidad y clave numérica es única. Los identificadores textuales se recorren en orden BINARY explícito, por lo que la misma fuente produce la misma correspondencia al repetir el procedimiento en destinos nuevos. Los nuevos IDs se obtienen del resultado de SQLite, no se calculan en JavaScript.

Los nombres, correos, hashes de contraseña, planes, fechas, huellas y textos JSON se copian literalmente. El procedimiento no vuelve a aplicar normalización de correo ni regenera hashes. Los códigos de cuenta, planes, instrumentos y tokens que aparezcan en el contenido mantienen su representación. El propietario de cada favorito se resuelve mediante la relación SQLite original y la correspondencia persistida de usuarios.

## Alcance deliberadamente estricto

La herramienta reconoce los esquemas administrados de `users` y, si existe, `favorite_simulations`, tanto con las claves TEXT anteriores como con claves INTEGER compatibles. Debe existir la tabla completa de usuarios. Un archivo de favoritos sin usuarios no permite fabricar propietarios y se rechaza.

Se rechazan antes de crear destinos las extensiones desconocidas del esquema, entre ellas tablas adicionales, vistas, triggers, índices explícitos y columnas o restricciones que la herramienta no pueda preservar. También se rechazan variantes con AUTOINCREMENT, columnas generadas, esquemas de usuarios incompletos y fuentes ya dotadas de `identifier_migration_map`. Estas situaciones requieren una migración coordinada específica, no eliminar componentes para que esta herramienta acepte la base.

La comparación del DDL conserva los literales SQL. Los nombres que se parezcan al prefijo reservado de SQLite, como `sqliteXextra`, siguen siendo extensiones visibles y se rechazan. No se ignoran tablas por una coincidencia de comodines.

Un entero fuera del rango seguro, una clave textual nula o vacía, una relación huérfana o un fallo de integridad provoca el rechazo. El respaldo conserva el esquema anterior.

## Secuencia del procedimiento

1. Comprobar rutas distintas y padres existentes. Fuente, respaldo y salida deben ser archivos diferentes. Los destinos deben ser nuevos.
2. Abrir el origen con `readOnly: true` e inspeccionar esquema e integridad.
3. Reservar los destinos con apertura exclusiva `wx`, evitando sobrescrituras incluso si otro proceso crea un archivo durante la comprobación.
4. Generar el respaldo mediante la API `backup` de SQLite. Esto incluye las escrituras confirmadas que todavía estén en WAL.
5. Cerrar la fuente y abrir el respaldo en modo de solo lectura. Toda la transformación parte de esa instantánea consistente.
6. Crear el esquema de salida e insertar usuarios, correspondencias y favoritos dentro de `BEGIN IMMEDIATE`.
7. Validar claves numéricas antes de convertir bigint, comprobar recuentos, `PRAGMA integrity_check` y `PRAGMA foreign_key_check`.
8. Confirmar la transacción y volver a comprobar integridad.

La herramienta no incorpora autenticación ni reasigna sesiones. Si otra aplicación sigue escribiendo en la fuente después del respaldo, sus cambios posteriores no formarán parte de esa instantánea. Por ello la ejecución real debe coordinar el cierre de los procesos que usen la base y el momento del cambio de ruta.

## Comandos preparados para una ejecución futura autorizada

Los siguientes comandos son instrucciones de uso. No se ejecutaron sobre datos existentes durante esta auditoría.

Desde el backend del worktree Sprint 1, con Node 24 disponible:

```powershell
npm.cmd run build

$sourceDb = 'C:\ruta-aprobada\usuarios.sqlite'
$backupDb = 'C:\ruta-aprobada\usuarios-respaldo-uuid.sqlite'
$outputDb = 'C:\ruta-aprobada\usuarios-numericos.sqlite'

node dist/migrations/migrateNumericIdentifiers.js `
  --source $sourceDb `
  --output $outputDb `
  --backup $backupDb `
  --apply-copy
```

Los directorios deben existir y los dos destinos deben estar libres. La herramienta rechaza argumentos desconocidos o repetidos. No tiene una opción de migración automática ni una opción de sobrescritura.

Una ejecución satisfactoria devuelve `COPY_MIGRATED`, rutas y recuentos. No imprime registros de usuarios, correos, hashes o claves antiguas. La correspondencia está dentro de la base de salida y debe tratarse con la misma privacidad que los datos de usuarios.

Antes de cambiar `USER_DB_PATH`, la revisión debe comprobar la integridad, los recuentos, la correspondencia de propietarios, los hashes existentes y la compatibilidad del registro y favoritos. El responsable de autenticación debe acordar cómo renovar o invalidar sesiones y tokens que referencien los identificadores anteriores. US29 y US33 deberán consumir los nuevos IDs numéricos.

## Fallos y recuperación

Si el esquema es incompatible, el proceso termina con error sin iniciar la transformación. Si falla después de reservar destinos, el respaldo y la salida pueden permanecer en el disco. La transacción de salida se revierte cuando está activa. No se borran automáticamente esos artefactos y no debe utilizarse una salida fallida. Se conservan para revisión y un reintento debe elegir destinos nuevos.

Como la fuente no se modifica, recuperar el estado anterior consiste en mantener la aplicación apuntando a su ruta original. Si ya se autorizó y efectuó un cambio de ruta, el retorno debe coordinarse antes de aceptar nuevas escrituras para evitar perder cambios posteriores. No se debe restaurar mediante sobrescritura automática ni borrar archivos.

La copia de respaldo conserva el esquema anterior y sus datos, incluida la instantánea consistente de WAL. El archivo original también se conserva. No se incluyen bases, respaldos o mapas con información personal en Git.

## Pruebas ejecutadas

La suite de migración aprobó 26 casos y quedó incluida en las 129 pruebas de backend del Sprint 1. Se comprobaron correspondencias estables, preservación literal de datos y hashes, propietarios, unicidad, claves foráneas, recuentos, INTEGER dispersos y MAX_SAFE_INTEGER, rechazo de IDs fuera de rango, rollback, claves nulas, huérfanos, esquemas extendidos, AUTOINCREMENT, destinos existentes, alias de rutas, consentimiento explícito, WAL y límites del CLI.

Las pruebas utilizan exclusivamente bases temporales sintéticas. Las bases existentes inspeccionadas durante la auditoría conservaron sus hashes SHA-256. No se ha realizado una migración real.
