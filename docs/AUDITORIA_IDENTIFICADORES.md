# Auditoría y corrección de identificadores de Yupay Finance

Fecha: 6 de noviembre de 2026.

Actualización posterior de US32: el equipo sustituyó la integración con un proveedor externo por una pasarela académica local `DEMO` / `LOCAL_MOCK`. El flujo actual y sus pruebas se describen en [SPRINT3.md](SPRINT3.md). Este informe conserva los resultados y el estado Git de la auditoría de identificadores anterior a esa ampliación; sus cifras no son el inventario de la nueva entrega de US32. La selección de proveedor, SDK y credenciales externas ya no es una dependencia de la demostración.

## Resumen ejecutivo

Se corrigieron las claves internas de usuarios del Sprint 1 y de favoritos y propietarios del Sprint 3. El contrato es `number` entero positivo seguro en TypeScript y JSON, e `INTEGER PRIMARY KEY` en SQLite. La base de datos asigna las claves al omitir `id` en el INSERT. Se eliminaron las llamadas a `randomUUID()` de esos flujos.

La corrección incluye modelos, datos de alta, repositorios, validación de identidad, relaciones, fixtures, pruebas y comprobación de respuestas frontend. Se conservaron scrypt, correo único, simuladores, deduplicación, autorización Pro y las restricciones existentes de las historias.

Sprint 2 fue auditado y validado sin cambios de código, pruebas o documentación. Sus identificadores textuales son códigos de negocio, contenido o DOM/ARIA. Los productos que ya tenían identificador numérico conservaron su contrato.

Se implementó una herramienta explícita de migración sobre respaldo y salida nuevos. Se probó exclusivamente con datos sintéticos temporales. Las cinco bases SQLite preexistentes inspeccionadas conservan su SHA-256 original. La migración real requiere autorización posterior y no se ejecutó.

## Estado inicial y alcance de Git

| Worktree | Rama | HEAD inicial y final | Estado inicial |
| --- | --- | --- | --- |
| Principal | `main` | `8cc91626a456e03f52f83ae5e0e143dd6e2405de` | Limpio |
| `.worktrees/sprint1` | `feat/sprint1-us01-us02-completo` | `a7afd4622a01aabf022584e5b3aed9bf6ba32b70` | Limpio, commit anterior conservado |
| `.worktrees/sprint2` | `feat/sprint2-us21-us24-completo` | `7e361cd1b62783ea39c12b9912e09c049591d340` | Limpio, commit anterior conservado |
| `.worktrees/sprint3` | `feat/sprint3-us28-us31-us32` | `8cc91626a456e03f52f83ae5e0e143dd6e2405de` | 6 modificados y 20 nuevos preexistentes |

Se leyeron los documentos `SPRINT1.md`, `SPRINT2.md` y `SPRINT3.md`, los estados Git, los commits de entrega, modelos, servicios, controladores, repositorios, interfaces y pruebas. No se encontró `AGENTS.md` aplicable en los directorios inspeccionados.

No se realizaron nuevos commits, push, Pull Requests, merge, rebase, cherry-pick, reset, clean ni cambios del índice. No se recrearon ramas o worktrees. Los cambios locales anteriores del Sprint 3 se conservaron y las correcciones se aplicaron sobre ellos.

## Clasificación de identificadores

| Clase | Ejemplos | Resultado |
| --- | --- | --- |
| Claves internas propias | `User.id`, `Favorite.id`, `Favorite.userId`, identidad del resolvedor | `number` seguro; PK/FK INTEGER |
| Códigos de negocio | `AH-001`, `BASICO`, `PRO`, instrumentos, beneficios | Permanecen como texto |
| Seguridad | Bearer tokens, tokens de pasarela, salt de scrypt, huella SHA-256 | Permanecen opacos o criptográficos según su función |
| DOM y contenido | Identificadores ARIA, términos del glosario, claves de columnas | Permanecen como texto |
| Contratos de otros módulos | `FinancialProduct.id`, `productId` | Ya numéricos; se conservan |

La búsqueda de UUID no se utilizó como reemplazo textual general. Los UUID presentes en fixtures de datos anteriores prueban su rechazo o migración. Un nombre aleatorio de carpeta temporal no es una clave persistente de usuario.

## Justificación de las decisiones técnicas

Esta sección explica las decisiones de la auditoría de identificadores y sus consecuencias. El inventario posterior distingue los cambios de esta corrección de la implementación previa de cada Sprint.

### 1. Contrato numérico de extremo a extremo

**Cambio.** Usuarios, favoritos y propietarios usan `number` en dominio, repositorios, identidad autenticada y respuestas JSON. Las claves correspondientes son INTEGER en SQLite.

**Motivo.** El equipo confirmó este contrato. Mantener un usuario textual y un propietario numérico obligaría a adaptaciones inconsistentes entre registro, autenticación y favoritos. La corrección alcanza los límites HTTP y frontend para detectar una respuesta de otra versión antes de confirmar la operación.

**Consecuencia.** Es un cambio contractual para los consumidores de `user.id`, `favorite.id` y `favorite.userId`. US03, US29 y US33 tendrán que consumir el mismo tipo. Las bases antiguas necesitan una correspondencia explícita entre claves, que queda pendiente de aplicar con autorización.

### 2. SQLite asigna las claves

**Cambio.** Se eliminó `randomUUID()` de los servicios y se omite `id` al insertar usuarios y favoritos.

**Motivo.** La persistencia dispone de las restricciones y de la coordinación de escritura. Generar IDs mediante azar, tiempo o contadores de proceso dificultaría garantizar el contrato entre procesos. SQLite devuelve la clave realmente persistida, que se valida antes de confirmar.

**Consecuencia.** La entidad recibe su identidad al guardarse. No se promete que los IDs sean consecutivos, que no tengan huecos o que representen una fecha. Tampoco se añade una garantía de secreto: un ID numérico no sustituye la autorización.

### 3. INTEGER PRIMARY KEY sin AUTOINCREMENT

**Cambio.** Las tablas nuevas utilizan `INTEGER PRIMARY KEY` como alias de rowid. No se añadió AUTOINCREMENT.

**Motivo.** Esa definición ya permite la asignación automática necesaria. No existe un requisito adicional documentado que justifique incorporar AUTOINCREMENT. El procedimiento evita imponer una política nueva de identidad que el equipo no haya acordado.

**Consecuencia.** Si el equipo exige en el futuro una política específica de no reutilización de claves, tendrá que evaluarla expresamente. Las variantes INTEGER PRIMARY KEY DESC o WITHOUT ROWID se rechazan cuando no cumplen la generación esperada. La herramienta de migración también rechaza una fuente AUTOINCREMENT cuya secuencia no está preparada para preservar.

### 4. Tipos separados para alta y entidad persistida

**Cambio.** Se introdujeron `NewUser = Omit<User, "id">` y `NewFavorite = Omit<Favorite, "id">`.

**Motivo.** Antes del INSERT todavía no existe una clave asignada. Expresar esa diferencia en el tipo impide que el servicio tenga que inventar un identificador provisional y hace explícito qué devuelve el repositorio.

**Consecuencia.** Los adaptadores y mocks deben aceptar datos de alta sin clave y devolver una entidad completa con una clave válida. El contrato permite probar esa responsabilidad sin acoplar los servicios a una llamada concreta de SQLite.

### 5. Rango seguro de JavaScript y lecturas bigint

**Cambio.** Los IDs admitidos son enteros entre 1 y `Number.MAX_SAFE_INTEGER`. Las lecturas SQLite se realizan como bigint y la conversión ocurre después de validar el rango. Las bases nuevas incluyen CHECK.

**Motivo.** El contrato acordado usa `number`, que no representa exactamente todos los enteros de 64 bits de SQLite. Una conversión imprecisa podría asociar una operación a una identidad equivocada. La comprobación runtime complementa los tipos TypeScript porque HTTP, SQLite y adaptadores pueden aportar valores incompatibles.

**Consecuencia.** Un valor int64 válido para SQLite puede estar fuera del contrato de la aplicación y se rechaza. No se cambia la API a bigint ni se devuelve bigint en JSON. Al agotarse el rango se revierte el alta; en favoritos se informa `ENTITY_ID_OUT_OF_RANGE`. El registro mantiene su error genérico ante una imposibilidad de alta fuera de contrato y conserva 409 para duplicados.

### 6. Validación frontend de las respuestas exitosas

**Cambio.** Registro y favoritos comprueban que la respuesta contiene un ID numérico positivo seguro.

**Motivo.** Un HTTP exitoso puede proceder de un backend con un contrato anterior o de una respuesta incompleta. Confirmar el flujo sin revisar la clave ocultaría esa incompatibilidad durante la integración grupal.

**Consecuencia.** Una operación podría haber quedado persistida si un servidor responde después con un cuerpo incompatible. El cliente comunica el problema y conserva las protecciones de unicidad y deduplicación para los reintentos. Esta comprobación no valida exhaustivamente todos los campos de todos los DTO.

### 7. Transacciones, restricciones y casos límite

**Cambio.** Las operaciones de guardado utilizan `BEGIN IMMEDIATE`, comprobaciones dentro de la transacción y las restricciones UNIQUE correspondientes. Cualquier fallo de validación del ID revierte la escritura.

**Motivo.** Una consulta previa hecha fuera de la transacción puede quedar obsoleta ante solicitudes concurrentes. Además, se reprodujo que SQLite podía evaluar el CHECK del siguiente ID antes del conflicto UNIQUE al alcanzar el límite seguro.

**Consecuencia.** Consultar el correo y el favorito existente dentro de la transacción conserva los comportamientos previstos incluso en ese límite: registro duplicado 409 y favorito repetido 200. Se mantiene UNIQUE como protección definitiva. Las transacciones se limitan a la operación de persistencia; el hash de contraseña y el cálculo de simulación se realizan previamente.

### 8. Identidad del propietario desde el resolvedor

**Cambio.** Ruta, servicio y repositorio exigen un ID numérico válido. El cuerpo del favorito no admite que el cliente seleccione su propietario.

**Motivo.** El cambio de UUID a un número no determina quién está autorizado. Esa decisión debe seguir dependiendo de una sesión comprobada y del plan vigente del usuario.

**Consecuencia.** El arranque normal conserva HTTP 401 hasta conectar el resolvedor real. Las identidades Pro de las pruebas permanecen aisladas. El registro conserva BASICO como plan inicial y la membresía vigente será responsabilidad de la integración de autenticación y suscripciones.

### 9. Códigos, tokens y huellas conservados

**Cambio.** `AH-001`, `BASICO`, `PRO`, instrumentos, beneficios, claves DOM/ARIA, tokens y huellas siguen usando su contrato anterior.

**Motivo.** Su función es identificar negocio, contenido, controles o credenciales. Su representación textual no constituye la incompatibilidad detectada en las claves internas. La huella SHA-256 sigue resolviendo equivalencia de parámetros; el ID numérico identifica el registro persistido.

**Consecuencia.** No cambia el significado de códigos ni se reduce la entropía de credenciales. No se modifican contratos de productos o proveedores por semejanza de nombres como `id`.

### 10. Sprint 2 sin cambios artificiales

**Cambio.** Se auditó y se ejecutó regresión; se conservaron sus archivos fuente, pruebas y documentación.

**Motivo.** FSD y glosario no introducían UUID persistentes propios. Cambiar sus códigos de cuentas, términos o ARIA ampliaría el alcance y podría romper funcionalidades ajenas al problema.

**Consecuencia.** La auditoría queda documentada en este informe global y el worktree Sprint 2 continúa limpio. Sus resultados financieros y contenido no cambian por esta tarea.

### 11. Detección del esquema anterior antes de escribir

**Cambio.** Los repositorios inspeccionan las claves y relaciones existentes antes del DDL correspondiente y bloquean el uso incompatible.

**Motivo.** Cambiar una interfaz TypeScript o ejecutar CREATE TABLE IF NOT EXISTS no transforma los registros UUID ya almacenados. El usuario reservó expresamente la autorización de una migración real.

**Consecuencia.** La base local anterior del Sprint 1 permanece protegida y su arranque requiere migración autorizada o una ruta nueva para demostrar el código corregido. Favoritos mantiene la aplicación disponible y responde una dependencia explícita al intentar guardar sobre un esquema incompatible. No se garantiza compatibilidad con un esquema arbitrario ajeno al proyecto.

### 12. Migración hacia respaldo y salida nuevos

**Cambio.** La herramienta abre el origen en solo lectura, reserva destinos nuevos con `wx`, crea un respaldo SQLite consistente y transforma ese respaldo hacia una salida nueva.

**Motivo.** Así se conserva el original, se evita sobrescribir archivos y se incluye la información confirmada que todavía esté en WAL. Trabajar desde el respaldo da a la transformación una instantánea coherente.

**Consecuencia.** Se necesita espacio para los archivos adicionales y revisar qué base utilizará después la aplicación. Una copia fallida puede permanecer para inspección, con su transacción revertida cuando corresponda. Antes de un cambio real se debe coordinar el cierre de escritores y las sesiones para evitar divergencias posteriores al respaldo.

### 13. Correspondencia estable, preservación literal y esquema admitido

**Cambio.** La migración recorre claves TEXT en orden BINARY, obtiene los nuevos IDs de SQLite y guarda la correspondencia en `identifier_migration_map`. Conserva IDs INTEGER seguros y copia literalmente los demás campos. Rechaza extensiones del esquema que no sabe preservar.

**Motivo.** Las relaciones necesitan una correspondencia verificable; un UUID no tiene una conversión aritmética válida al ID deseado. Mantener hashes, correo y JSON evita alterar credenciales o resultados durante una corrección de identidad. Rechazar tablas, índices o triggers desconocidos impide omitir componentes del trabajo grupal.

**Consecuencia.** El mismo origen produce el mismo mapa al repetir sobre destinos nuevos. El procedimiento está diseñado para los esquemas administrados actuales y no es un migrador genérico. Una futura base extendida necesitará un procedimiento coordinado. La tabla del mapa también contiene identificadores y debe protegerse como la base de usuarios.

### 14. Compatibilidad comprobada sin fusionar ramas

**Cambio.** Se utilizaron los módulos reales compilados de registro y favoritos dentro de un proceso temporal con SQLite nuevo e identidades sintéticas.

**Motivo.** Permite verificar que la clave generada por registro es aceptada por favoritos sin mezclar archivos de producción ni alterar los historiales independientes.

**Consecuencia.** La prueba acredita compatibilidad de los contratos y esquemas ensayados. No acredita que las tres ramas estén integradas ni completa autenticación, historial de favoritos o procesamiento de pago.

### 15. Pruebas y documentación del cambio contractual

**Cambio.** Se adaptaron expectativas antiguas y se añadieron casos de límite, JSON, datos anteriores, concurrencia, integridad y migración. La revisión independiente aportó regresiones del filtro de nombres SQLite y de los literales del DDL.

**Motivo.** Cambiar el tipo exige demostrar el comportamiento persistido, la precisión y las relaciones. Las pruebas que fallaron antes de las correcciones de concurrencia y esquema aportan evidencia de que se resolvió el problema observado.

**Consecuencia.** Las cifras de la sección de pruebas corresponden a las ejecuciones de la auditoría. La ampliación de este reporte añadió documentación y no requirió repetir las suites ni modificar código. Las pruebas de ramas independientes comparten casos base, por lo que sus totales no se suman como pruebas únicas.

### 16. Alcance de historias y conservación local

**Cambio.** Se aplicaron las correcciones en sus worktrees y se conservaron los commits anteriores y los cambios locales del Sprint 3.

**Motivo.** La tarea autorizó una corrección compatible y reservó publicación, integración de ramas y migración real para una decisión posterior. US03, US29 y US33 pertenecen a otras historias.

**Consecuencia.** Los cambios siguen disponibles para revisión local. Autenticación y membresía continúan pendientes según lo documentado. Los planes y checkout conservaron sus contratos existentes durante esta auditoría. La ampliación posterior de US32 utiliza una simulación local, por lo que no requiere SDK o procesamiento externos.

## Sprint 1: registro y unicidad de correo

Rama `feat/sprint1-us01-us02-completo`, directorio `C:\Users\Magaz_\proyecto-software2\.worktrees\sprint1`.

### Cambios productivos

- `User.id` y `PublicUser.id` son numéricos.
- `NewUser = Omit<User, "id">` distingue el alta de la entidad persistida.
- `UserRepository.create(NewUser): User` devuelve el identificador asignado por SQLite.
- `RegistrationService` deja de generar UUID y valida el resultado del repositorio antes de exponerlo.
- `SqliteUserRepository` inserta sin `id`, utiliza `BEGIN IMMEDIATE`, comprueba `lastInsertRowid` y confirma únicamente dentro del rango seguro.
- Las lecturas usan `setReadBigInts(true)` para evitar conversiones silenciosas de int64.
- El formulario exige un `user.id` numérico, positivo y seguro después de HTTP 201 antes de confirmar y redirigir.

Nuevo esquema de identidad:

```sql
id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 9007199254740991)
```

No se añadió AUTOINCREMENT. Permanecen los campos de nombre, correo, hash, plan y fecha, así como `email TEXT NOT NULL COLLATE NOCASE UNIQUE`.

El constructor inspecciona las bases existentes antes de ejecutar DDL. Rechaza PK TEXT, compuesta o INTEGER que no sea alias rowid, cierra la conexión y produce `UserSchemaMigrationRequiredError`. No altera automáticamente una base anterior.

### Comportamiento conservado

Se mantienen validaciones de nombre, correo y contraseña, confirmación frontend, scrypt y salt, normalización de correo, detección de duplicados, HTTP 400/409/201, concurrencia y persistencia. Un ID enviado por el cliente no sustituye la clave generada por SQLite.

La estructura HTTP sigue siendo `{ message, user }`; el cambio contractual es `user.id` como número JSON. US03 continúa pendiente. La integración de autenticación deberá consumir IDs numéricos y resolver por separado la membresía vigente.

### Archivos de esta corrección

Modificados: `RegistrationService.ts`, `User.ts`, `UserRepository.ts`, `SqliteUserRepository.ts`, `registration.test.ts`, `RegistrationForm.tsx`, `RegistrationForm.test.tsx` y `docs/SPRINT1.md`.

Nuevos: `registration/domain/NumericIdentifier.ts`, `migrations/NumericIdentifierMigration.ts`, `migrations/migrateNumericIdentifiers.ts`, `tests/migrations/numericIdentifiers.test.ts` y `docs/MIGRACION_IDENTIFICADORES.md`.

Total: 8 modificados y 5 nuevos. Los controladores y rutas conservaron su código porque reciben el contrato corregido a través del servicio.

## Sprint 2: FSD y glosario

Rama `feat/sprint2-us21-us24-completo`, directorio `C:\Users\Magaz_\proyecto-software2\.worktrees\sprint2`.

Se revisaron FSD, glosario, contratos de cuentas y productos, resultados, App, tabla y pruebas. No se encontraron UUID propios usados como PK/FK. Los estados FSD son códigos semánticos. `CuentaAhorros.id` y `cuentaId` identifican códigos de cuentas. Las claves del glosario y de columnas identifican contenido. Los IDs HTML y ARIA identifican controles. `FinancialProduct.id` y `productId` ya son números del simulador existente.

No se modificó ningún archivo fuente, prueba o documento. La regresión incluyó estados FSD, evidencia válida e inválida, propagación de metadatos, ambas modalidades de plazo fijo, cálculos, filtros, búsqueda sin tildes, estado vacío y navegación del glosario. Solo se regeneraron artefactos ignorados de build y coverage.

## Sprint 3: favoritos, planes y checkout

Rama `feat/sprint3-us28-us31-us32`, directorio `C:\Users\Magaz_\proyecto-software2\.worktrees\sprint3`.

### Favoritos

`AuthenticatedUser.id`, `Favorite.id` y `Favorite.userId` son `number`. `NewFavorite` omite el identificador. El repositorio genera `favorite_simulations.id INTEGER PRIMARY KEY` y utiliza `user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`.

Se mantienen transacciones, unicidad de propietario/huella, recálculo en servidor y separación entre usuarios. La identidad runtime se valida en ruta, servicio y repositorio sin convertir UUID, cadenas numéricas o bigint suministrados por el resolvedor. El cliente no puede elegir el propietario mediante `userId` en el cuerpo.

Las respuestas mantienen HTTP 201/200/400/401/403/404/503. `favorite.id` y `favorite.userId` ahora son números JSON. El frontend valida la clave recibida antes de confirmar.

El guardado detecta un esquema TEXT o una relación/clave incompatible antes de crear tablas y devuelve `503 NUMERIC_ID_MIGRATION_REQUIRED`. Se rechazan también PK INTEGER DESC o WITHOUT ROWID que no autogeneren como alias rowid. Las lecturas se realizan como bigint y la conversión está acotada al rango seguro. El agotamiento del rango o un valor persistido inválido produce `503 ENTITY_ID_OUT_OF_RANGE`.

Se comprobó un caso límite de SQLite: la evaluación del CHECK del siguiente ID podía ocurrir antes de resolver un duplicado. El repositorio consulta primero el favorito existente dentro de `BEGIN IMMEDIATE`. Así un reintento sigue funcionando cuando el favorito existente tiene ID MAX_SAFE_INTEGER, manteniendo UNIQUE como protección final.

### Archivos corregidos sobre la entrega local previa

- `backend/src/favorites/domain/Favorite.ts`
- `backend/src/favorites/application/FavoriteService.ts`
- `backend/src/favorites/infrastructure/SqliteFavoriteRepository.ts`
- `backend/src/favorites/interface/favoriteRoutes.ts`
- `backend/tests/sprint3/favorites.test.ts`
- `backend/tests/sprint3/fixtures/integrationServer.ts`
- `frontend/src/commerce/FavoriteButton.tsx`
- `frontend/src/commerce/FavoriteButton.test.tsx`
- `docs/SPRINT3.md`

Nuevos en esta auditoría: `backend/tests/sprint3/numericIdentifiers.test.ts` y este informe. El conjunto pendiente de Sprint 3 pasa de 26 a 28 archivos, con 6 modificados y 22 nuevos frente al HEAD, ya que la implementación anterior aún no tenía commit.

### Planes y checkout

Durante la auditoría de identificadores, US31 y US32 no necesitaron cambios productivos. Se conservaron `BASICO` y `PRO` como códigos de negocio, `GET /api/plans`, comparación, carga/error, navegación y precios pendientes. La ampliación posterior de US32 reemplaza su configuración inicial por `DEMO` y añade procesamiento ficticio local; la actualización no modifica estos códigos ni los IDs internos corregidos.

US32 no atribuye la operación a un usuario real. Su contrato académico aporta referencia DEMO, resultado, fecha y plan. US33 deberá acordar cómo relacionar esa referencia con una identidad numérica verificada y gestionar las suscripciones del proyecto. No se exige un token de SDK externo, no se añadió un `userId` arbitrario al formulario y la simulación no activa Pro.

## Matriz final de auditoría

| Rama | Archivo o contrato | Tipo anterior | Tipo nuevo | Justificación |
| --- | --- | --- | --- | --- |
| Sprint 1 | `registration/domain/User.ts` | `User.id: string` | `number`; alta sin id | Identidad interna SQLite |
| Sprint 1 | `registration/domain/UserRepository.ts` | `create(User)` | `create(NewUser): User` | Persistencia asigna la clave |
| Sprint 1 | `RegistrationService.ts` | UUID generado en servicio | ID persistido validado | Una única fuente de identidad |
| Sprint 1 | `SqliteUserRepository.ts` | `TEXT PRIMARY KEY` | `INTEGER PRIMARY KEY` | Generación y rango seguros |
| Sprint 1 | `NumericIdentifier.ts` | Sin guardia común | Validador number/bigint acotado | Precisión y JSON |
| Sprint 1 | Registro HTTP y frontend | Admitía respuesta201sin verificar id | Exige número seguro | Contrato extremo a extremo |
| Sprint 1 | Pruebas de registro | Fixtures textuales | IDs reales numéricos y casos inválidos | Regresión y límites |
| Sprint 1 | Herramienta/pruebas de migración | Ausentes | Copias y mapa TEXT→INTEGER | Protección de datos anteriores |
| Sprint 2 | FSD/glosario/cuentas/DOM | Códigos textuales o producto numérico existente | Sin cambio | No son UUID internos incompatibles |
| Sprint 3 | `Favorite.ts` | `id/userId/AuthenticatedUser.id: string` | `number`; `NewFavorite` | Contrato compartido con usuarios |
| Sprint 3 | `FavoriteService.ts` | `randomUUID()` | Alta sin clave | SQLite genera la PK |
| Sprint 3 | `SqliteFavoriteRepository.ts` | PK/FK TEXT | PK/FK INTEGER | Relaciones, dedupe y límites |
| Sprint 3 | `favoriteRoutes.ts` | Identidad truthy textual posible | Exige number seguro | Autoridad de propietario |
| Sprint 3 | Fixtures y pruebas | Usuarios/expectativas textuales | SQLite INTEGER e IDs numéricos | Integración y seguridad |
| Sprint 3 | `FavoriteButton.tsx` y pruebas | ID truthy | Number positivo seguro | Validar respuesta HTTP |
| Sprint 3 | US31/US32 | Códigos de planes/tokens | Sin cambio | Contratos de negocio y proveedor |

## Compatibilidad entre ramas sin fusionarlas

Se ejecutó un proceso temporal externo a los worktrees que cargó los módulos compilados reales de registro del Sprint 1 y favoritos del Sprint 3. Utilizó una base nueva, dos usuarios registrados por HTTP y un resolvedor sintético exclusivo de ese proceso.

Flujo comprobado: registro HTTP 201 → lectura del mismo id en repositorio → identidad sintética asociada a ese id → guardado HTTP 201 → reintento HTTP 200 → reapertura del repositorio → mismo favorito. Se comprobaron HTTP 401 sin identidad, HTTP 403 para Básico, rechazo de `userId` ajeno, un favorito propio distinto para el segundo usuario, tipos INTEGER, recuentos por propietario, integridad y FK. No existe un endpoint de lectura de US29: la petición de acceso a un favorito por esa ruta devuelve 404, y la persistencia se inspeccionó directamente en el fixture para comprobar el propietario.

Evidencia local del ensayo satisfactorio:

```text
C:\Users\Magaz_\AppData\Local\Temp\yupay-identifiers-cross-sprint-9be97ce8a7124859b163e84307379a9f\compatibility.cjs
C:\Users\Magaz_\AppData\Local\Temp\yupay-identifiers-cross-sprint-9be97ce8a7124859b163e84307379a9f\results.json
```

El script puede repetirse exclusivamente en una carpeta temporal nueva, copiando allí el archivo del ensayo y pasando como argumento la raíz del repositorio, después de compilar ambos backends. No debe repetirse en su directorio ya utilizado, porque sus usuarios sintéticos ya existen. Los servidores se cerraron. Esto demuestra compatibilidad de los módulos y esquemas en un proceso aislado; las ramas no están integradas ni existe autenticación Pro productiva.

| Origen | Destino | Contrato compartido | Resultado |
| --- | --- | --- | --- |
| US01 | US28 | `User.id` y `userId` numéricos, PK/FK | Verificado mediante módulos reales, HTTP y SQLite temporal |
| US01 | Autenticación | Identificador del usuario | Contrato numérico preparado; integración US03 pendiente |
| US28 | US29 | ID de favorito y propietario | Contrato y persistencia verificados; historial/gestión pendientes |
| US31 | US32 | Código de plan `PRO` | Verificado en regresión y navegación; continúa como string |
| US32 | US33 | Usuario numérico y referencia de operación | Pendiente de integrar identidad y suscripciones. US32 aporta una referencia DEMO local, sin proveedor o SDK externo |

## Pruebas ejecutadas el 6 de noviembre

| Sprint | Backend | Frontend | Build | Lint |
| --- | --- | --- | --- | --- |
| 1 | 129 aprobadas, 0 fallidas, 9 archivos | 42 aprobadas, 0 fallidas, 4 archivos | Ambos aprobados | Ambos aprobados |
| 2 | 79 aprobadas, 0 fallidas, 8 archivos | 38 aprobadas, 0 fallidas, 6 archivos | Ambos aprobados | Ambos aprobados |
| 3 | 126 aprobadas, 0 fallidas, 10 archivos | 55 aprobadas, 0 fallidas, 8 archivos | Ambos aprobados | Ambos aprobados |

Los totales incluyen pruebas de la base compartida. No deben sumarse como casos únicos del proyecto. Las dos integraciones HTTP del Sprint 3 están incluidas en sus 55 pruebas frontend. Las 26 pruebas de migración están incluidas en las 129 del backend Sprint 1. La prueba cruzada temporal es una comprobación adicional.

Comandos por backend:

```powershell
npm.cmd run coverage
npm.cmd run build
npm.cmd run lint
```

Comandos de frontend, usando la inclusión pertinente en cada worktree:

```powershell
# Sprint 1
npm.cmd test -- --coverage '--coverage.include=src/registration/**'
# Sprint 2
npm.cmd test -- --coverage '--coverage.include=src/{fsd,glosario}/**'
# Sprint 3
npm.cmd test -- --coverage '--coverage.include=src/commerce/**'

npm.cmd run build
npm.cmd run lint -- --ignore-pattern coverage
```

La cobertura ejecuta las suites completas y evita repetir un test idéntico sin motivo. Solo se excluyeron de lint reportes generados. No se ocultaron fuentes.

| Alcance | Líneas | Ramas | Funciones |
| --- | --- | --- | --- |
| Backend Sprint1 global | 90,69% | 80,64% | 93,39% |
| Frontend registro | 100% | 96,07% | 100% |
| Backend Sprint2 global | 85,90% | 78,04% | 93,65% |
| Frontend FSD/glosario | 97,61% | 93,22% | 100% |
| Backend Sprint3 global | 89,22% | 85,53% | 94% |
| Frontend comercio | 98,94% | 88,39% | 95,83% |

Coberturas de módulos: repositorio de usuarios 97,14 % de líneas, migraciones 95,83 % de líneas, FSD backend 94,44 % de líneas y 97,36 % de ramas, y repositorio de favoritos 98,03 % de líneas y 93,33 % de ramas.

### Incidencias resueltas durante las verificaciones

- El fixture de migración de favoritos huérfanos inicialmente no desactivaba FK para construir deliberadamente ese estado inválido. Falló su preparación y dejó un error secundario de limpieza. Se corrigió el fixture, sin relajar código productivo; la suite final pasó completa.
- La revisión independiente detectó un filtro incorrecto del prefijo sqlite_ y una normalización de DDL que podía alterar literales. Ambos se corrigieron y tienen regresión específica.
- Se reprodujo el caso de registro al alcanzar MAX_SAFE_INTEGER: dos solicitudes concurrentes de un mismo correo podían devolver HTTP 201/500 porque SQLite evaluaba el CHECK antes de UNIQUE. La comprobación de correo dentro de la transacción mantiene el resultado HTTP 201/409; dos regresiones nuevas fallaban antes y pasan con la corrección.
- El primer intento frontend Sprint 3 dentro del sandbox no pudo iniciar dos procesos de integración: tsx falló en os.userInfo con uv_os_get_passwd ENOMEM. La ejecución posterior con escalación aprobada ejecutó 55/55, sin modificar dependencias ni omitir casos.
- La primera ejecución del ensayo cruzado falló en una aserción del prototipo del objeto devuelto por node:sqlite, después de pasar los pasos HTTP. Se corrigió únicamente la comparación del harness y se repitió con una base nueva; el ensayo final pasó.

No se ejecutó una revisión visual de navegador en esta corrección de contratos. No se hicieron pruebas reales de autenticación o pago y no se migraron datos reales. La decisión posterior del equipo permite probar la pasarela académica local de US32 sin conexiones bancarias; sus comprobaciones se documentan en SPRINT3.md.

## Protección de las bases existentes

Se inspeccionaron cinco archivos existentes en solo lectura. La base de Sprint 1 contiene `users.id TEXT` y una fila; las dos bases anteriores de registro de `.tools` también usan TEXT. Las dos bases antiguas de previsualización de favoritos tienen la tabla TEXT y cero favoritos, sin tabla de usuarios. Todos los `integrity_check` iniciales devolvieron `ok` y no hubo incidencias en `foreign_key_check`. No se imprimieron registros ni hashes de contraseñas.

| Archivo relativo a la raíz | SHA-256 antes y después |
| --- | --- |
| `.worktrees/sprint1/backend/data/usuarios.sqlite` | `ad4168a37a7181dd16e7937d014104173b36dd4992690ad16597fd9b1f7cb3c3` |
| `.tools/review-final-zKGpmC/users.sqlite` | `29c656876b5fae85bc330ecbfc610208a42dcccf49cad480022cfcd00f40e644` |
| `.tools/review-users.sqlite` | `9df42eaeff95be96adb943494f015636d937f516d4432d41c5907177d581eda2` |
| `.tools/sprint3-preview-D5Jne0/users.sqlite` | `5fc04da7ff88894bf15ab31fe171d716bcc44fe15a181afe3df361d8a62db431` |
| `.tools/sprint3-preview-yxr6pV/users.sqlite` | `5fc04da7ff88894bf15ab31fe171d716bcc44fe15a181afe3df361d8a62db431` |

El procedimiento preparado en Sprint1/docs/MIGRACION_IDENTIFICADORES.md genera respaldo y salida nuevos, con mapa estable, integridad y relaciones, usando origen de solo lectura. Ante un esquema desconocido lo rechaza para coordinar su migración. No elimina artefactos al fallar ni sobrescribe destinos. Solo se ejecutó sobre fixtures temporales. El cambio de USER_DB_PATH de la aplicación a una copia migrada y la política de sesiones requerirán revisión y autorización.

## Pendientes reales

1. Autorizar y coordinar, si procede, una migración de las bases existentes. No se requiere para ejecutar las pruebas con bases nuevas.
2. Adaptar e integrar US03 al identificador numérico; si una librería requiere un subject textual, adaptar únicamente ese límite de un ID numérico verificado, nunca convertir UUID.
3. Resolver la membresía vigente desde el sistema del equipo. El registro conserva BASICO; el Pro utilizado en las pruebas es sintético.
4. Acordar con US29 consumo de id/userId numéricos y política de versiones de instantáneas; su historial y gestión no se implementaron.
5. Acordar con US33 usuario numérico verificado, referencia DEMO, resultado y gestión de suscripciones. Los precios siguen pendientes de definición comercial. La demostración académica no requiere pasarela externa, SDK ni credenciales y no ejecuta pagos bancarios.
6. Después de una migración autorizada, coordinar sesiones antiguas y cualquier tabla o servicio ajeno que use las claves anteriores. La herramienta rechaza esquemas extendidos en lugar de perder sus componentes.
7. Revisar y autorizar futuros commits o publicación. Esta auditoría no contiene esa autorización.

## Estado de Git al finalizar la auditoría de identificadores

Se ejecutaron en cada worktree estos comandos:

```powershell
git branch --show-current
git status --short --untracked-files=all
git diff --check
```

También se comprobó HEAD y staging. Sprint 1 conserva 13 archivos pendientes (8 modificados y 5 nuevos), Sprint 2 sigue limpio y Sprint 3 conserva 28 (6 modificados y 22 nuevos, incluidos los 26 preexistentes). `main` sigue limpio en el mismo commit. `git diff --check` termina sin errores. Los avisos LF/CRLF son de normalización futura de Git, no fallos de espacios. El sandbox impide leer un ignore global, por lo que para los inventarios se usó `git -c core.excludesFile= status ...`; no se modificó la configuración Git.

Los tres sprints siguen separados. No hay nuevos commits, push, PR, fusiones ni reescritura del historial. No se eliminaron o alteraron datos de las bases existentes. Las pruebas limpiaron únicamente sus propios fixtures temporales; los ensayos de compatibilidad y algunos probes conservan datos exclusivamente sintéticos fuera de los worktrees.

## Salida final de comprobaciones Git

### sprint1

```text
$ git branch --show-current
feat/sprint1-us01-us02-completo

$ git status --short --untracked-files=all
 M backend/src/registration/application/RegistrationService.ts
 M backend/src/registration/domain/User.ts
 M backend/src/registration/domain/UserRepository.ts
 M backend/src/registration/infrastructure/SqliteUserRepository.ts
 M backend/tests/registration/registration.test.ts
 M docs/SPRINT1.md
 M frontend/src/registration/RegistrationForm.test.tsx
 M frontend/src/registration/RegistrationForm.tsx
?? backend/src/migrations/NumericIdentifierMigration.ts
?? backend/src/migrations/migrateNumericIdentifiers.ts
?? backend/src/registration/domain/NumericIdentifier.ts
?? backend/tests/migrations/numericIdentifiers.test.ts
?? docs/MIGRACION_IDENTIFICADORES.md

$ git diff --check
(sin errores, exit 0)
```

### sprint2

```text
$ git branch --show-current
feat/sprint2-us21-us24-completo

$ git status --short --untracked-files=all
(limpio)

$ git diff --check
(sin errores, exit 0)
```

### sprint3

```text
$ git branch --show-current
feat/sprint3-us28-us31-us32

$ git status --short --untracked-files=all
 M .gitignore
 M backend/src/app.ts
 M backend/src/index.ts
 M frontend/src/App.tsx
 M frontend/src/tabla_ahorros/TablaAhorrosView.tsx
 M frontend/src/tabla_ahorros/useTablaAhorrosController.ts
?? backend/src/checkout/checkoutRoutes.ts
?? backend/src/favorites/application/FavoriteService.ts
?? backend/src/favorites/domain/Favorite.ts
?? backend/src/favorites/infrastructure/SqliteFavoriteRepository.ts
?? backend/src/favorites/interface/favoriteRoutes.ts
?? backend/src/plans/Plan.ts
?? backend/tests/sprint3/commerce.test.ts
?? backend/tests/sprint3/favorites.test.ts
?? backend/tests/sprint3/fixtures/integrationServer.ts
?? backend/tests/sprint3/numericIdentifiers.test.ts
?? docs/AUDITORIA_IDENTIFICADORES.md
?? docs/SPRINT3.md
?? frontend/src/commerce/Checkout.test.tsx
?? frontend/src/commerce/Checkout.tsx
?? frontend/src/commerce/FavoriteButton.test.tsx
?? frontend/src/commerce/FavoriteButton.tsx
?? frontend/src/commerce/PlanComparison.test.tsx
?? frontend/src/commerce/PlanComparison.tsx
?? frontend/src/commerce/Sprint3.integration.test.tsx
?? frontend/src/commerce/Sprint3App.test.tsx
?? frontend/src/commerce/commerce.css
?? frontend/src/commerce/types.ts

$ git diff --check
(sin errores, exit 0)
```
