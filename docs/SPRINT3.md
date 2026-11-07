# Sprint 3 de Yupay Finance

## Estado de la entrega local

Rama `feat/sprint3-us28-us31-us32`.

Worktree `C:\Users\Magaz_\proyecto-software2\.worktrees\sprint3`.

Base `main` y `origin/main` en `8cc91626a456e03f52f83ae5e0e143dd6e2405de`, comprobada el 4 de noviembre de 2026 mediante fetch. Los cambios están pendientes de commit en este worktree. Las implementaciones de los Sprints 1 y 2 se consultaron como referencia de arquitectura y persistencia.

La referencia de requisitos es el archivo entregado `C:\Users\Magaz_\Downloads\Sprint3_Backlog.xlsx`. El texto de la solicitud menciona una variante con sufijo `(2)`, pero el archivo disponible tiene el nombre indicado aquí.

| Historia | Ubicación en la hoja Sprint 3 | Tareas |
| --- | --- | --- |
| US28 | A25:G27 | TS-87, TS-88, TS-89 |
| US31 | A40:G43 | TS-96, TS-141, TS-142, TS-143 |
| US32 | A45:G47 | TS-97, TS-98, TS-99 |
| Dependencia US29 | A30:G32 | Historial y gestión de favoritos |
| Dependencia US33 | A50:H52 | Procesamiento del pago y activación Pro |

El backlog aporta los títulos y tareas. Los precios, la periodicidad comercial y los campos fiscales obligatorios necesitan definición del equipo. La decisión posterior del equipo establece una pasarela académica completamente simulada para US32, sin proveedor externo, SDK ni credenciales. TS-141 aparece también en US35, fila 60. Esta entrega utiliza el TS-141 asociado a US31, fila 41.

## US28 y sus dependencias

El servicio guarda favoritos de ahorro y plazo fijo. Valida los parámetros y recalcula la instantánea con `MotorCalculo` y `FixedDepositSimulationService`. Los resultados y la identidad del propietario se obtienen en el servidor.

La interfaz incorpora un botón Guardar favorito en cada fila de la tabla de ahorros, con estado de envío, confirmación, error y acceso a planes ante una cuenta Básica. El plazo de la tabla se transmite desde su controlador, por lo que el botón utiliza la misma simulación que se está mostrando. La interfaz de resultados de plazo fijo sigue siendo una dependencia del equipo. El servicio de favoritos ya admite sus parámetros para esa integración.

### Contrato de autenticación

`createApp` admite un segundo argumento opcional de tipo `Sprint3Dependencies`. La integración de autenticación debe aportar `resolveUser(request)` y devolver un usuario verificado con `id` y `plan` vigente, o `null`.

El arranque normal devuelve `null` mientras esa integración esté pendiente. En consecuencia, Guardar favorito muestra el mensaje de inicio de sesión y la API responde 401. El servicio aplica también la autorización Pro cuando se llama directamente. El transporte de sesión del frontend debe integrarse con el mecanismo de autenticación del equipo. El cliente actual utiliza credenciales del mismo origen. Un desarrollo con cookies entre los puertos 5173 y 3000 necesita que el equipo defina conjuntamente el transporte y su política CORS.

El usuario y la membresía deben resolverse a partir de una sesión comprobada y del estado de suscripción mantenido por US33 y su ciclo de vida. Los cuerpos y cabeceras que declaren un usuario o plan arbitrario son rechazados o ignorados. El fixture de integración utiliza identidades sintéticas únicamente dentro de un proceso con `NODE_ENV=test` y canal IPC.

### Persistencia relacional

`SqliteFavoriteRepository` usa SQLite integrado en Node 24. La tabla `favorite_simulations` contiene `id`, `user_id`, `fingerprint`, `instrument`, `parameters_json`, `snapshot_json` y `created_at`. Tras la corrección contractual del 6 de noviembre, `id` es `INTEGER PRIMARY KEY` generado por SQLite y `user_id` es `INTEGER`; ambos se exponen como `number` en TypeScript y JSON.

- `user_id` referencia `users(id)` con clave foránea activa y borrado en cascada.
- La tabla `users` corresponde al contrato corregido del registro del Sprint 1, con `id INTEGER PRIMARY KEY`. El módulo de favoritos crea únicamente su propia tabla. Una cuenta ausente o un esquema de usuarios pendiente produce el error 503 `USER_PERSISTENCE_REQUIRED`.
- La combinación única de usuario y huella evita duplicados. La huella usa SHA-256 sobre los parámetros normalizados y el producto seleccionado.
- El alta y la lectura del resultado se realizan en una transacción. Un reintento conserva el identificador y la instantánea originales. Otro propietario puede guardar sus propios parámetros equivalentes.
- La ruta de la base se selecciona mediante `USER_DB_PATH`. Su valor predeterminado es `data/usuarios.sqlite`. Los archivos SQLite locales están excluidos de Git.

Se adoptó como decisión técnica la deduplicación por propietario y parámetros, incluyendo el producto o la cuenta. Si el mercado cambia para esos mismos parámetros, un reintento conserva la primera instantánea. El equipo debe acordar con US29 si en el futuro desea incorporar versiones de mercado a esa identidad.

### API para US29

`POST /api/favorites` recibe uno de estos cuerpos.

```json
{ "instrument": "AHORROS", "accountId": "AH-001", "days": 365 }
```

```json
{
  "instrument": "PLAZO_FIJO",
  "productId": 1,
  "amount": "1000.00",
  "termDays": 360,
  "department": "Lima",
  "paymentMode": "AT_MATURITY"
}
```

La respuesta contiene `favorite`, `created` y `message`. El favorito incluye su propietario, parámetros, instantánea y fecha ISO. En plazo fijo los Decimal de la instantánea se serializan como texto y US29 puede aplicar su formato visual.

| HTTP | Significado |
| --- | --- |
| 201 | Favorito creado |
| 200 | Simulación ya guardada por ese usuario |
| 400 | Parámetros inválidos o campos ajenos |
| 401 | Sesión pendiente o inválida |
| 403 | Membresía Básica |
| 404 | Cuenta o producto ausente para esos parámetros |
| 503 | Persistencia o servicio pendiente de integración |

US29 puede utilizar la clave `user_id` para sus consultas futuras y los identificadores del contrato para gestionar cada favorito. Los endpoints de historial, eliminación y actualización pertenecen a esa historia.

### Auditoría y corrección de identificadores del 6 de noviembre de 2026

El equipo acordó identificadores numéricos para entidades internas. Se sustituyeron los UUID de favoritos y los identificadores de usuario textuales por enteros positivos seguros. `AuthenticatedUser.id`, `Favorite.id` y `Favorite.userId` son `number`. `NewFavorite` omite el identificador, y el repositorio inserta sin especificar `id`, de modo que SQLite genera la clave. No se utiliza `AUTOINCREMENT`, UUID, marcas de tiempo, contadores locales ni `MAX(id) + 1` para generar estas claves.

`POST /api/favorites` conserva su cuerpo y sus códigos de respuesta. El cambio contractual afecta a `favorite.id` y `favorite.userId` en la respuesta, que ahora son números JSON. Un ejemplo reducido es `{"favorite":{"id":1,"userId":1},"created":true}`. El frontend comprueba que el identificador recibido sea un `number` entero positivo seguro antes de confirmar el guardado. US29 deberá utilizar el mismo contrato numérico para favoritos y propietarios.

Los límites de identidad se validan mediante `Number.isSafeInteger()`, sin convertir cadenas, UUID ni tokens a números. La ruta, el servicio y el repositorio rechazan identidades incompatibles. Los identificadores que entregue la futura autenticación deben ser números comprobados, con valores entre `1` y `9007199254740991` inclusive. El resolvedor predeterminado sigue siendo `null`: el arranque normal mantiene HTTP 401 hasta integrar autenticación y membresía reales.

Las nuevas columnas incorporan restricciones `CHECK` para ese rango. Las lecturas de identificadores SQLite utilizan `setReadBigInts(true)` y solo convierten a `number` después de comprobar el límite. Ningún `bigint` se envía directamente como JSON. Un identificador persistido fuera del rango, o el agotamiento del rango al insertar, produce HTTP 503 con `ENTITY_ID_OUT_OF_RANGE`, sin redondearlo ni conservar una inserción parcial. Los reintentos de un favorito existente siguen funcionando incluso si su clave es `Number.MAX_SAFE_INTEGER`.

Se conservaron como texto los códigos de cuenta, instrumentos y planes (`BASICO` y `PRO`), los identificadores de beneficios, las huellas SHA-256 y los tokens opacos de autenticación o pago. `productId` conserva el contrato numérico que ya tenía el simulador. US31 y US32 no requirieron cambios de producción por la auditoría de identificadores. La ampliación posterior de US32 a pasarela DEMO se describe más abajo y conserva esos contratos numéricos.

#### Protección de bases anteriores

Antes de crear tablas, el repositorio inspecciona el esquema de usuarios y favoritos. Una clave de usuario o favorito `TEXT`, una relación incompatible, una restricción de deduplicación ausente o una clave que no sea alias `rowid` (`INTEGER PRIMARY KEY DESC` o `WITHOUT ROWID`) deja el repositorio bloqueado para escritura con HTTP 503 `NUMERIC_ID_MIGRATION_REQUIRED`. No se convierten UUID mediante `Number()` o `parseInt()`, ni se alteran o reemplazan tablas automáticamente. Los fixtures temporales verifican que abrir y rechazar una base UUID conserva exactamente sus bytes y sus registros.

La herramienta de migración explícita de usuarios y favoritos está implementada y probada con fixtures en el worktree del Sprint 1. Consulta `C:\Users\Magaz_\proyecto-software2\.worktrees\sprint1\docs\MIGRACION_IDENTIFICADORES.md`. Su ejecución sobre una base local existente requiere autorización posterior del usuario. Genera respaldo y salida nuevos, conserva el mapa estable de identificadores anteriores a nuevos, hashes, correos únicos, instantáneas y relaciones. Esta auditoría utiliza únicamente bases temporales para probar esos cambios.

Los fixtures de integración ahora crean `users(id INTEGER PRIMARY KEY)` y permiten que SQLite genere sus claves. Los tokens de prueba continúan siendo cadenas opacas exclusivas del proceso `NODE_ENV=test`, sin habilitar autenticación sintética en el arranque normal.

#### Pruebas de la corrección

Se añadieron 21 casos backend en `backend/tests/sprint3/numericIdentifiers.test.ts`: generación SQLite, serialización JSON, identidades UUID/textuales/`bigint`/no seguras, protección del esquema anterior, claves que no son alias `rowid`, claves foráneas, integridad, límites de 64 bits, máximo seguro y rollback. Se actualizaron las pruebas y fixtures existentes de favoritos al contrato numérico y se añadieron seis casos frontend para rechazar identificadores incompatibles en respuestas exitosas.

| Comprobación ejecutada el 6 de noviembre | Resultado |
| --- | --- |
| Backend, `npm.cmd run coverage` | 126 aprobadas, 0 fallidas, 10 archivos |
| Backend, `npm.cmd run build` y `npm.cmd run lint` | Aprobados |
| Cobertura global backend | 89,22 % líneas, 85,53 % ramas, 94 % funciones |
| Frontend, `npm.cmd test -- --coverage '--coverage.include=src/commerce/**'` | 55 aprobadas, 0 fallidas, 8 archivos, incluidas las dos integraciones HTTP |
| Frontend, `npm.cmd run build` y `npm.cmd run lint -- --ignore-pattern coverage` | Aprobados |
| Cobertura frontend de comercio | 98,94 % líneas, 88,39 % ramas, 95,83 % funciones |

En el primer intento aislado del frontend, 53 pruebas pasaron y las dos integraciones no pudieron arrancar porque `tsx` falló en `os.userInfo()` con `uv_os_get_passwd ENOMEM`. La repetición autorizada fuera de esa limitación del entorno ejecutó las 55 pruebas y todas pasaron. No se modificó la dependencia ni se omitieron pruebas para obtener ese resultado.

## US31

`GET /api/plans` devuelve `plans` y `features`. Los códigos de plan son `BASICO` y `PRO`, compatibles con el código `BASICO` utilizado por el registro anterior. Ambos tienen `price` en `null` hasta que se defina la oferta comercial.

La matriz compara las simulaciones existentes, los favoritos Pro de US28, el informe avanzado de US25/US27 y el PDF Pro de US30. Presenta carga, error con reintento y catálogo vacío. El informe y el PDF se identifican como pendientes de integración en el texto de la pantalla.

La navegación normal utiliza el enlace Planes, la ruta `/planes` y el botón Continuar al checkout Pro. El precio aparece como pendiente de definición. Los límites de cantidad de favoritos y las condiciones de cobro requieren especificación comercial antes de incorporarse.

## US32

### Decisión académica y flujo completo

El equipo decidió que la pasarela será una simulación local completa. Esta decisión sustituye la espera anterior de un proveedor externo para US32. No se necesita Stripe, Culqi, Mercado Pago, SDK, credenciales ni sandbox de terceros.

El checkout existente se abre desde la comparación de planes en `/checkout`. Consulta `GET /api/checkout/config`, que declara `environment: "DEMO"`, `provider: "LOCAL_MOCK"`, `simulation: true`, captura y procesamiento de demostración disponibles, y `realPaymentsAvailable` y `membershipActivationAvailable` en `false`.

La misma pantalla contiene facturación, titular ficticio, tarjeta de demostración, fecha, CVV, confirmación, estado de procesamiento y resultado. Los avisos DEMO permanecen visibles. El precio continúa pendiente de definición y no se representa ningún cargo monetario.

La facturación conserva nombre o razón social y correo como datos mínimos. Para una demostración se deben utilizar datos sintéticos. El esquema fiscal completo permanece fuera de la simulación actual.

### Formato libre de datos ficticios

El ajuste posterior elimina los números predeterminados. Cualquier secuencia ficticia de 16 dígitos puede iniciar el pago simulado si el resto del formulario es válido. El aviso visible es **Simulación académica — No utilizar tarjetas reales**. Se comprueba formato; no se verifica la existencia de una tarjeta bancaria ni se exige Luhn.

| Campo | Validación |
| --- | --- |
| Número | Exactamente 16 dígitos ASCII, con o sin espacios. Se agrupa visualmente de cuatro en cuatro. Letras, guiones y otros caracteres se rechazan. |
| Titular | Obligatorio, sin aceptar solo espacios y con máximo de 120 caracteres. |
| Vencimiento | MM/AA, meses 01–12 y fecha igual o posterior al mes actual del navegador. El año representa 2000–2099. |
| CVV | Exactamente tres dígitos ficticios; cualquier combinación numérica de esa longitud. |
| Facturación | Se conservan nombre o razón social obligatorio y correo válido, con sus límites anteriores. |
| Resultado | Aprobado por defecto. La casilla opcional **Simular rechazo (solo DEMO)** permite ensayar un rechazo con los mismos datos válidos. |

Ejemplo libre: número `0000 1111 2222 3333`, vencimiento `12/30` mientras siga vigente, CVV `123` y titular `Persona de demostración`. Facturación: `Persona de prueba`, `factura@example.com`. Estos valores son ejemplos y no una lista de tarjetas admitidas. También pueden utilizarse otras secuencias ficticias con el mismo formato.

Los errores se muestran debajo de cada campo. Una longitud de 12 o 17 dígitos produce **El número de tarjeta debe contener exactamente 16 dígitos**. El formato visual no elimina caracteres inválidos ni recorta una entrada demasiado larga para convertirla en válida. Se retiraron los límites HTML que podían ocultar el exceso de dígitos del número o del CVV antes de validarlos.

El titular, el número, la fecha y el CVV permanecen únicamente en memoria durante la interacción y no se incluyen en la petición, URLs, SQLite, logs ni almacenamiento del navegador. Se desactiva el autocompletado de los campos de demostración; esa indicación no controla todas las funciones de un navegador configurado por el usuario. Al admitir formato numérico libre, la aplicación no puede determinar si el usuario escribió datos reales: por eso mantiene el aviso y descarta estos campos sin transmitirlos.

Al terminar un intento enviado, o al abandonar el formulario, se limpian los datos del formulario. Una validación local fallida muestra errores y permite corregirlos. Mientras existe una petición en curso se impiden envíos repetidos. La navegación cancela la espera y evita mostrar resultados tardíos.

### Endpoint de simulación

`POST /api/checkout/simulate` recibe exclusivamente plan, escenario permitido y facturación mínima:

```json
{
  "planId": "PRO",
  "scenarioId": "DEMO_APPROVED",
  "billing": {
    "name": "Persona de prueba",
    "email": "factura@example.com"
  }
}
```

El escenario normal es `DEMO_APPROVED`; activar la casilla opcional envía `DEMO_DECLINED`. El número de tarjeta nunca determina el escenario. El servidor vuelve a validar el plan, el escenario, la estructura y los datos de facturación. Rechaza campos inesperados, incluidos tarjeta, CVV, vencimiento, titular, tokens y propietarios enviados por el cliente. El servicio de simulación está separado del controlador HTTP. No consulta bancos, redes externas ni bases de datos y no persiste la facturación.

Ejemplo de respuesta estructurada:

```json
{
  "reference": "DEMO-0123456789ABCDEF01234567",
  "outcome": "APPROVED",
  "simulation": true,
  "environment": "DEMO",
  "occurredAt": "2026-11-06T12:00:00.000Z",
  "planId": "PRO",
  "amount": null,
  "message": "Resultado de demostración",
  "declineReason": null
}
```

Las referencias son etiquetas opacas con prefijo DEMO y bytes aleatorios; no son claves primarias de entidades ni identificadores de usuarios. Las respuestas aprobadas y rechazadas utilizan HTTP 200, porque ambos son resultados válidos de la simulación. El rechazo incluye `outcome: "DECLINED"` y `declineReason: "Fondos ficticios insuficientes."`. Una solicitud inválida devuelve HTTP 400; un error interno controlado del servicio produce HTTP 503 sin exponer datos recibidos.

Se conserva `POST /api/checkout/validate-billing` para validar el contrato anterior de facturación, ahora con entorno DEMO. El formulario completo utiliza el endpoint de simulación, que reutiliza esa validación. El cambio de configuración de sandbox externo pendiente a DEMO disponible es intencional por la nueva decisión del equipo.

### Integración con US33 y límites

US33 puede consumir `reference`, `outcome`, `simulation`, `environment`, `occurredAt` y `planId` para la simulación académica del grupo. Debe acordarse cómo asociar la operación con un usuario numérico verificado y gestionar las suscripciones cuando se integren las ramas. La respuesta de demostración no modifica usuarios ni activa Pro. No existe un cobro real ni se emite una factura fiscal.

La demostración puede realizarse sin autenticación integrada. La restricción de favoritos permanece: visitantes reciben 401 y cuentas Básicas 403. Las pruebas comprueban que una aprobación DEMO no cambia esos privilegios.

El sistema actual es deliberadamente local, sin tokenización, liquidación bancaria, verificación de titular o certificación de una pasarela real. Esas capacidades no son requisitos de la decisión académica actual. Los parámetros comerciales siguen pendientes para cualquier integración futura que los necesite.

### Componentes ampliados y decisiones

Se reutilizaron la ruta `/checkout`, la navegación desde US31, la validación existente de facturación y las variables visuales del proyecto. `BillingValidation.ts` permite compartir las mismas reglas entre el endpoint de facturación y `MockPaymentService.ts`. El controlador HTTP delega en ese servicio y traduce los errores sin registrar los datos recibidos.

`demoCards.ts` contiene el formateo y las reglas locales de número, titular, fecha y CVV. Ya no contiene una lista de tarjetas o una asociación de números a resultados. El backend recibe únicamente un escenario permitido, por lo que no necesita capturar o tokenizar una tarjeta. Las referencias opacas DEMO no son claves de usuarios o favoritos y no alteran el contrato numérico corregido. El servicio y sus endpoints no necesitaron cambios para este ajuste.

Después de validar se muestra **Procesando pago…** y se deshabilitan controles y botón. El resultado reemplaza temporalmente al formulario y presenta **Pago aprobado** o **Pago simulado rechazado**, referencia, fecha/hora y Plan Pro, junto con la confirmación DEMO. El botón **Volver a la aplicación** regresa al inicio mediante la navegación existente. Al iniciar otro intento los campos y la casilla de rechazo están vacíos o desactivados. Se aborta y limpia también con `pagehide`, que cubre la salida hacia la caché de navegación aunque React siga montado. Una respuesta tardía o un JSON que termine después de abandonar no confirma una operación. La doble pulsación se bloquea mediante el estado de envío y una referencia a la petición en curso.

Los estilos nuevos están limitados al checkout. En escritorio presentan dos columnas; a partir del breakpoint de 680 px pasan a una, incluyendo fecha y CVV. Los códigos y referencias permiten salto de línea y se respeta la preferencia de movimiento reducido. La revisión visual de esos tamaños sigue limitada por la herramienta de navegador, como se indica abajo.

### Archivos de esta ampliación de US32

Nuevos:

- `backend/src/checkout/BillingValidation.ts`
- `backend/src/checkout/MockPaymentService.ts`
- `backend/tests/sprint3/mockPayments.test.ts`
- `frontend/src/commerce/demoCards.ts`
- `frontend/src/commerce/demoCards.test.ts`

Ampliados sobre los cambios locales anteriores:

- `backend/src/checkout/checkoutRoutes.ts`
- `backend/tests/sprint3/commerce.test.ts`
- `frontend/src/commerce/Checkout.tsx`
- `frontend/src/commerce/Checkout.test.tsx`
- `frontend/src/commerce/commerce.css`
- `frontend/src/commerce/Sprint3App.test.tsx`
- `frontend/src/commerce/Sprint3.integration.test.tsx`
- `docs/SPRINT3.md`
- `docs/AUDITORIA_IDENTIFICADORES.md`, para actualizar referencias históricas a proveedor o SDK obligatorio.

### Comprobaciones de la pasarela DEMO

| Comprobación ejecutada | Resultado |
| --- | --- |
| Backend, `npm.cmd run coverage` | 156 aprobadas, 0 fallidas, 11 archivos |
| Frontend, cobertura de `src/commerce/**` | 143 aprobadas, 0 fallidas, 9 archivos |
| Backend y frontend, `npm.cmd run build` | Aprobados |
| Backend lint y frontend lint excluyendo únicamente `coverage` | Aprobados |
| Backend global | 89,83 % de líneas, 86,71 % de ramas, 94,28 % de funciones |
| Frontend de comercio | 100 % de líneas, 95,52 % de ramas, 100 % de funciones |
| Integración React con Express y SQLite reales | Cuatro flujos incluidos y aprobados |
| `git diff --check` | Sin errores |

Las cuatro integraciones comprueban guardado y reintento de favoritos con IDs numéricos, planes, aprobación normal con 16 dígitos, rechazo mediante casilla DEMO, nuevo intento aprobado, retorno al inicio, demo de visitante y conservación de 401/403 en favoritos. Las peticiones se inspeccionan para verificar que no contienen número de tarjeta, titular, vencimiento ni CVV. Las pruebas de componentes y helper cubren 12/16/17 dígitos, letras y otros caracteres, espacios y agrupación visual, ausencia de Luhn obligatorio, titular vacío, CVV incompleto/alfabético/largo, meses 00/13, formato MM/AA, mes actual, mes anterior, cambio de año, facturación, resultados, respuestas inválidas, fallos HTTP/red, doble envío, limpieza, navegación, desmontaje y `pagehide`. El backend comprueba lista de escenarios, campos permitidos, rechazo de datos ajenos, errores 503 y ausencia de eco, logs y llamadas externas.

Los totales incluyen las pruebas preexistentes del Sprint 3. Las cuatro integraciones y las 94 pruebas dirigidas de Checkout/helper están incluidas en las 143 pruebas frontend; no deben sumarse como casos adicionales. En la adaptación inicial de un fixture de BFCache quedó un antiguo código de tarjeta predeterminado: se actualizó a un número ficticio válido y la casilla de rechazo. La ejecución final pasa sin fallos y conserva esa comprobación de seguridad.

Los controles de integración y la suite frontend se ejecutaron con escalación aprobada para superar la limitación conocida de `tsx` y `os.userInfo()` dentro del sandbox. No se omitieron pruebas ni se cambiaron dependencias.

No se pudo realizar la comprobación visual de escritorio o móvil. En la revisión anterior el navegador integrado no estuvo disponible y Computer Use detuvo el acceso a Chrome porque no pudo determinar su URL con suficiente confianza. En este ajuste se comprobó nuevamente la disponibilidad y el host del navegador integrado seguía inaccesible. Los flujos funcionales se verificaron mediante React/Testing Library y HTTP real; esto no equivale a una medición visual de los tamaños de pantalla. Los servidores temporales de la revisión anterior se cerraron y en este ajuste no se inició una previsualización adicional.

Se compararon hashes de los archivos versionados y nuevos antes y después de esta tarea. Los Sprints 1 y 2 conservaron exactamente sus archivos, sus cambios previos y sus HEAD. El código y las pruebas de US28 y los modelos numéricos no cambiaron. US31 conserva su implementación y se revalidó su navegación. La ampliación añadió cinco archivos a los 28 pendientes anteriores: el Sprint 3 queda con 33 archivos pendientes frente a HEAD, 6 modificados y 27 nuevos, con staging vacío. No se creó ningún commit, push, PR o merge y `main` permanece limpia en su mismo commit.

### Archivos del ajuste a formato numérico libre

Se modificaron `frontend/src/commerce/demoCards.ts`, `demoCards.test.ts`, `Checkout.tsx`, `Checkout.test.tsx`, `commerce.css`, `Sprint3.integration.test.tsx`, `frontend/src/App.tsx` y este documento. El cambio en App únicamente conecta el retorno del resultado al inicio. No se crearon archivos, ramas o worktrees y no se modificó producción backend. Los archivos nuevos y pendientes de la entrega anterior permanecen conservados.

## Archivos de la entrega

Modificados para integrar las historias.

- `.gitignore`
- `backend/src/app.ts`
- `backend/src/index.ts`
- `frontend/src/App.tsx`
- `frontend/src/tabla_ahorros/TablaAhorrosView.tsx`
- `frontend/src/tabla_ahorros/useTablaAhorrosController.ts`

Creados para backend y pruebas.

- `backend/src/plans/Plan.ts`
- `backend/src/checkout/BillingValidation.ts`
- `backend/src/checkout/MockPaymentService.ts`
- `backend/src/checkout/checkoutRoutes.ts`
- `backend/src/favorites/domain/Favorite.ts`
- `backend/src/favorites/application/FavoriteService.ts`
- `backend/src/favorites/infrastructure/SqliteFavoriteRepository.ts`
- `backend/src/favorites/interface/favoriteRoutes.ts`
- `backend/tests/sprint3/favorites.test.ts`
- `backend/tests/sprint3/commerce.test.ts`
- `backend/tests/sprint3/mockPayments.test.ts`
- `backend/tests/sprint3/numericIdentifiers.test.ts`
- `backend/tests/sprint3/fixtures/integrationServer.ts`

Creados para frontend y pruebas.

- `frontend/src/commerce/types.ts`
- `frontend/src/commerce/commerce.css`
- `frontend/src/commerce/FavoriteButton.tsx`
- `frontend/src/commerce/FavoriteButton.test.tsx`
- `frontend/src/commerce/PlanComparison.tsx`
- `frontend/src/commerce/PlanComparison.test.tsx`
- `frontend/src/commerce/Checkout.tsx`
- `frontend/src/commerce/Checkout.test.tsx`
- `frontend/src/commerce/demoCards.ts`
- `frontend/src/commerce/demoCards.test.ts`
- `frontend/src/commerce/Sprint3App.test.tsx`
- `frontend/src/commerce/Sprint3.integration.test.tsx`
- `docs/SPRINT3.md`
- `docs/AUDITORIA_IDENTIFICADORES.md`

## Comprobaciones del 4 de noviembre de 2026

| Comprobación ejecutada | Resultado |
| --- | --- |
| Backend, `npm.cmd run coverage` | 105 pruebas aprobadas en 9 archivos |
| Frontend, pruebas con cobertura de `src/commerce/**` | 49 pruebas aprobadas en 8 archivos |
| Backend y frontend, `npm.cmd run build` | Aprobados |
| Backend, `npm.cmd run lint` | Aprobado |
| Frontend, `npm.cmd run lint -- --ignore-pattern coverage` | Aprobado |
| Cobertura global backend | 88,29 % de líneas y 82,75 % de ramas |
| Cobertura frontend de comercio | 98,93 % de líneas y 88,18 % de ramas |
| Integración de frontend con Express y SQLite reales | Dos flujos aprobados mediante Testing Library y HTTP |
| Navegador integrado con arranque normal | Confirmados acceso a planes, checkout, validación vacía y válida, y mensaje de sesión pendiente al guardar |

Se probaron aislamiento por propietario, concurrencia, deduplicación de montos equivalentes, reapertura de SQLite, la clave foránea, respuestas HTTP, errores de red, navegación, carga y vacío del catálogo, validación de facturación y rechazo de campos sensibles. Las pruebas de integración tienen un fixture de autenticación aislado que utiliza únicamente usuarios sintéticos y bases temporales.

La revisión mediante accesibilidad del navegador confirmó los flujos contra el backend local. La captura de pantalla falló por tiempo de espera en `Page.captureScreenshot`, por lo que queda pendiente la revisión visual detallada de espaciado, colores y tamaños de pantalla. Los servidores temporales de esa revisión se cerraron al finalizar.

El script habitual de cobertura del frontend sigue midiendo filtros. La cobertura de comercio se obtuvo con el comando específico indicado abajo. La opción de lint excluye el reporte generado y conserva el análisis de los archivos fuente.

## Ejecutar con PowerShell

Se utilizó Node.js 24.22.2 portátil y las dependencias ya están instaladas en ambas carpetas. Para otra instalación se necesita Node 24 compatible con `node:sqlite` y ejecutar `npm.cmd ci` en backend y frontend.

Terminal del backend.

```powershell
$repo = 'C:\Users\Magaz_\proyecto-software2'
$env:Path = "$repo\.tools\node-v24.22.2-win-x64;$env:Path"
Set-Location "$repo\.worktrees\sprint3\backend"
$env:PORT = '3000'
npm.cmd run dev
```

Terminal del frontend.

```powershell
$repo = 'C:\Users\Magaz_\proyecto-software2'
$env:Path = "$repo\.tools\node-v24.22.2-win-x64;$env:Path"
Set-Location "$repo\.worktrees\sprint3\frontend"
$env:VITE_API_URL = 'http://localhost:3000'
npm.cmd run dev -- --port 5173 --strictPort
```

Abre `http://localhost:5173` y entra en Planes, o abre directamente `http://localhost:5173/checkout`. La API utiliza `http://localhost:3000`. Si necesitas elegir otro puerto, define `PORT` en la terminal del backend y `VITE_API_URL` con ese mismo origen en la terminal del frontend antes de arrancar.

Para repetir los controles del backend.

```powershell
npm.cmd run coverage
npm.cmd run build
npm.cmd run lint
```

Para repetir los controles del frontend.

```powershell
npm.cmd test -- --coverage '--coverage.include=src/commerce/**'
npm.cmd run build
npm.cmd run lint -- --ignore-pattern coverage
```

Para demostrar el flujo Pro con la identidad de pruebas y el servidor real, ejecuta desde frontend el test integrado. Necesita también las dependencias del backend instaladas.

```powershell
npm.cmd test -- src/commerce/Sprint3.integration.test.tsx
```

## Demostración desde la aplicación

1. Abre el inicio y pulsa Guardar favorito en una fila. En el arranque normal aparece la dependencia de inicio de sesión. El guardado Pro se demuestra mediante las pruebas integradas hasta que el equipo conecte la autenticación real.
2. Abre Planes desde la navegación. Revisa la comparación, el precio pendiente y el enlace al checkout Pro.
3. Pulsa Continuar al checkout Pro y confirma el formulario vacío para comprobar las validaciones.
4. Completa facturación y titular con datos ficticios. Escribe cualquier secuencia de 16 dígitos, por ejemplo `0000 1111 2222 3333`, una fecha igual o posterior al mes actual en MM/AA y un CVV ficticio de 3 dígitos. Deja desactivada la casilla de rechazo y pulsa **Pagar (simulación)**. Comprueba aprobación, referencia DEMO, fecha/hora y Plan Pro.
5. Inicia otra simulación, completa nuevamente los datos válidos y activa **Simular rechazo (solo DEMO)**. Puedes utilizar exactamente el mismo número. Comprueba el rechazo, su motivo ficticio y la opción de reintentar.
6. Prueba 12 o 17 dígitos, letras, un mes 13, una fecha anterior al mes actual o un CVV de 2/4 caracteres. El navegador debe mostrar el error específico sin iniciar una petición de simulación.
7. Vuelve a planes y al inicio. Comprueba la continuidad de los filtros y el semáforo preexistentes y que la aprobación de demostración no modifica el acceso a favoritos.

Para revisar los archivos pendientes.

```powershell
Set-Location 'C:\Users\Magaz_\proyecto-software2\.worktrees\sprint3'
git branch --show-current
git status --short --untracked-files=all
git diff --check
git diff
```

Los archivos nuevos aparecen con `??` y pueden abrirse desde el inventario anterior. Esta entrega se conserva localmente para revisión. La publicación requiere una instrucción posterior del usuario.

El informe completo de la corrección de los tres sprints, la prueba cruzada real con módulos de registro/favoritos, los hashes de bases protegidas y la matriz de compatibilidad están en [AUDITORIA_IDENTIFICADORES.md](AUDITORIA_IDENTIFICADORES.md).
