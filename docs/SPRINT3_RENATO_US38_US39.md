# Sprint 3 de Renato Almeyda

## Alcance y base

TS-116 implementa la programación periódica de US38. TS-121 implementa el encolado selectivo de US39. Base `origin/main` en `9a92378`, rama `feature/renato-us38-us39`, worktree `C:/Users/Renato/Documents/Codex/yupay-sprint3-us38-us39`.

Se inspeccionaron ramas y worktrees y se actualizaron referencias con fetch. No se encontraron implementaciones anteriores de estas tareas. Los worktrees originales se conservaron. Los archivos se entregan sin staging, commits, push, PR ni merges. Las dependencias usan los locks existentes.

## Arquitectura y ejecución

`MarketMonitoringJob` ejecuta inmediatamente al iniciar y después en cada intervalo. `start` es idempotente, `runOnce` comparte la promesa activa y los ticks que llegan durante un ciclo se omiten. No acumula ciclos atrasados. Acepta intervalos enteros entre 1 y 2147483647 ms y rechaza entradas ambiguas. Captura fallos de consulta, detector, receptor y logger. Los errores parciales se informan mediante el logger inyectado. Este diagnóstico técnico no implementa el registro persistente de ciclos TS-118.

`stop` cancela el temporizador, señala AbortSignal y espera el ciclo activo. Un adaptador que ignore la señal y nunca resuelva impedirá el drenaje. Las fuentes futuras deben respetar la cancelación. La aplicación espera el monitoreo y el mantenimiento de suscripciones antes de cerrar el servidor y sus conexiones. Dos señales de cierre no repiten el cierre.

`SqliteMarketDataProvider` lee el catálogo SQLite actual. Conserva entity_id y productId por separado, tasas y ratios como cadenas decimales, fecha de observación, fecha del informe y URL de procedencia cuando existe. Reutiliza SqliteSbsRiskRepository. Una fila de tasas inválida se omite y se reporta; un fallo del perfil de riesgo conserva la tasa con riesgo ausente y reporta el error. Una consulta global fallida se propaga al job. Las fechas de observación indican cuándo se leyó el catálogo, no una actualización del mercado.

`MonitoringCycleService` entrega las instantáneas al puerto MarketVariationDetector de TS-117. Ese componente deberá conservar la referencia anterior, comparar y producir eventos con identificadores estables y repetibles. El receptor opcional publica esos eventos. Si se detectan eventos sin receptor se produce un error. No se implementaron comparación, umbrales ni almacén de instantáneas históricas.

## Encolado y persistencia

TS-120 proporciona eventos y selecciones internas de destinatarios mediante AlertMatchingService. SelectiveNotificationEnqueuer valida todo el lote, comprueba acceso con ProAccessService y preferencias con NotificationPreferencesService, y entrega los aceptados a SQLite. La identidad proviene de usuarios reales; un campo plan enviado por un cliente carece de efecto. TS-120 conserva el cruce por entidad seguida y la selección inicial. La revalidación de la cola evita usar acceso o preferencias ya revocados.

Se reutilizan NotificationType y NotificationFrequency de US37. Las fechas deben usar ISO UTC canónico, por ejemplo `2026-11-15T00:00:00.000Z`. RESUMEN_DIARIO requiere availableAt futura proporcionada por el módulo que acuerde el horario y la zona. El consumidor solicita una frecuencia explícita. La cola no convierte resúmenes en alertas inmediatas y no agrupa resúmenes.

SqliteNotificationQueueRepository recibe la conexión compartida de la aplicación. Crea únicamente market_notification_queue y su índice mediante inicialización idempotente. No modifica las tablas de usuarios, favoritos, pagos o catálogo. Usa claves foráneas hacia users, parámetros SQL y BEGIN IMMEDIATE con rollback del lote ante fallos. No se deben anidar sus operaciones en una transacción externa de esa conexión.

La clave estable es el par eventId y userId, con restricción UNIQUE y representación JSON como idempotencyKey. Un reintento conserva el mensaje original, su frecuencia y su disponibilidad. Reutilizar eventId con contenido distinto produce error y revierte el lote. TS-117/TS-120 deben conservar el mismo eventId al reintentar. El mecanismo no garantiza publicación atómica del estado privado del futuro detector y la cola; esa coordinación queda al equipo.

Estados PENDING, CLAIMED, SENT y FAILED. pending consulta disponibles ordenados por availableAt e id. claimPending reserva un lote dentro de una transacción y entrega tokens aleatorios con vigencia de 1 ms a 24 h. Otra conexión no puede reclamarlo durante esa vigencia. Una reserva vencida vuelve a ser reclamable; el token anterior pierde validez. markDelivered y markFailed exigen id, token y reserva vigente. FAILED queda almacenado y no se reintenta automáticamente. US40 debe elegir una vigencia adecuada, verificar permisos antes de entregar y tratar la posibilidad de repetición si ocurre un fallo después de enviar y antes de confirmar. No se implementó SMTP, garantías de entrega exactamente una vez ni la política de reintentos TS-125.

## Composición y configuración

createMarketMonitoringRuntime conecta fuente, ciclo, job, cola, preferencias y acceso Pro. Devuelve job, queue, enqueuer, publisher y stop para uso interno. Las extensiones detector y matcher se inyectan juntas; falta de una de ellas se rechaza. El index actual conserva ambas ausentes. No se activa una selección ficticia de usuarios.

Variables en backend/.env.example

```dotenv
MARKET_MONITORING_ENABLED=false
MARKET_MONITORING_INTERVAL_MS=60000
```

Habilitar el monitoreo actual agenda únicamente consultas al catálogo local de demostración y muestra esa limitación al iniciar. Los datos SQLite se inicializan mediante openDatabase y se vuelven a leer en cada ciclo; no hay consultas en vivo a SBS ni bancos. No existe un sistema completo de alertas productivas hasta conectar TS-117, TS-120 y US40. TS-118, TS-119, TS-122 y TS-123 generales permanecen bajo responsabilidad del equipo. Las pruebas nuevas cubren los componentes propios y sus contratos.

## Demostración reproducible

Desde el worktree, instalar con `npm ci --prefix backend` y `npm ci --prefix frontend`.

```powershell
npm test --prefix backend -- --maxWorkers=2 tests/monitoring tests/notifications/queue tests/sprint3/marketNotifications.integration.test.ts
```

Las pruebas de integración usan dobles identificados para TS-117 y TS-120, con cola SQLite real. Comprueban reintento sin duplicados, reapertura, activación, detención y disponibilidad HTTP de Express tras un fallo. No envían correos. Los casos del job usan temporizadores falsos. La integración con fuentes externas es por contrato.

Para observar el arranque local, desde backend usar una DB_PATH de demostración aislada y ejecutar

```powershell
$env:DB_PATH = "data/demo-monitoreo.sqlite"
$env:MARKET_MONITORING_ENABLED = "true"
$env:MARKET_MONITORING_INTERVAL_MS = "1000"
npm run dev
```

Detener con Ctrl+C. La cola puede permanecer vacía porque faltan los detectores y el cruce. Para demostrar alertas y estados de cola utilizar las pruebas, que contienen usuarios y eventos sintéticos claramente delimitados. La base de demostración queda excluida por el gitignore existente.

## Relación comprobada con los diagramas

Se leyeron los cuatro drawio proporcionados. Se conservaron sin modificaciones.

| Diagrama | Correspondencia y diferencias |
| --- | --- |
| DC_US38_Monitoreo_Mercado | MarketMonitoringJob y MonitoringCycleService son clases reales. MarketDataProvider y MarketVariationDetector son puertos. SqliteMarketDataProvider adapta la base unificada, en lugar de los antiguos repositorios en memoria y JSON. MarketSnapshot y CycleResult son interfaces sin métodos validate o summarize. |
| DS_US38_Monitoreo_Mercado | Se implementan start, runOnce, consulta y entrega al detector/receptor inyectados. Guardar anteriores, comparar umbrales y registrar ciclos siguen pendientes de otros módulos. |
| DC_US39_Cola_Notificaciones | Existen SelectiveNotificationEnqueuer y SqliteNotificationQueueRepository. La deduplicación reside en la restricción SQLite. ProAccessService y NotificationPreferencesService se reutilizan. Se añaden FAILED, claimToken y leaseUntil. |
| DS_US39_Cola_Notificaciones | Se implementa recibir selección, persistir y reservar para un consumidor futuro. TS-120 se representa mediante AlertMatchingService y dobles en tests. TS-122 y envío US40 siguen pendientes. |

## Verificación final

La ejecución final de `npm test` en la raíz terminó con código 0. Se ejecutaron los scripts reales de pruebas, compilación y ESLint de ambos módulos. Cero pruebas fallidas u omitidas.

| Comprobación | Aprobadas | Fallidas | Resultado |
| --- | --- | --- | --- |
| TS-116, job y adaptador | 18 | 0 | Aprobado |
| TS-121, cola | 17 | 0 | Aprobado |
| Integración por contrato TS-116/TS-121 | 8 | 0 | Aprobado |
| Suite completa backend | 417 | 0 | Aprobado, incluye las 43 nuevas |
| Suite completa frontend | 327 | 0 | Aprobado |
| npm run build, backend y frontend | — | — | Ambos aprobados |
| npm run lint, backend y frontend | — | — | Ambos aprobados |
| npm test, raíz | 744 | 0 | Código 0 |

La suite específica se ejecutó también mediante el comando de demostración indicado arriba, con 43/43. Los informes reales permanecen en .test-results, excluido de Git. No se realizó inspección visual de navegador. Se conservaron todas las pruebas anteriores. Un primer intento dentro del sandbox falló por acceso al temporal de Vitest; se repitió con acceso autorizado. Un test de arranque necesitó esperar la primera ejecución antes de abrir Express para evitar iniciar manualmente un segundo ciclo en la propia prueba. La pasada final aprobó todas las comprobaciones.

No se añadieron dependencias ni se alteraron locks. npm ci informó 11 vulnerabilidades del lock de backend (10 moderadas y 1 alta) y 10 del frontend (9 moderadas y 1 alta). Se conservan para revisión independiente del equipo. No se ejecutó audit fix.

Las primeras tres etapas solo dependen de contratos de la misma etapa o anteriores y de módulos ya presentes en la base. El arranque y la prueba transversal se reservan para la cuarta etapa. La lista de grupos se contrasta con todos los archivos modificados y nuevos, sin usar staging ni crear commits.

## Cuatro grupos de archivos para commits manuales

Cada archivo pertenece a un solo grupo. Los grupos siguientes dependen de los anteriores. El adaptador de composición createMarketMonitoringRuntime, aunque está en monitoring/infrastructure, pertenece exclusivamente al cuarto commit.

### Grupo 1 de contratos

- backend/src/monitoring/domain/MonitoringContracts.ts
- backend/src/notifications/queue/domain/QueueContracts.ts
- backend/src/notifications/queue/domain/QueueValidation.ts

### Grupo 2 de TS-116

- backend/src/monitoring/application/MarketMonitoringJob.ts
- backend/src/monitoring/application/MonitoringCycleService.ts
- backend/src/monitoring/infrastructure/SqliteMarketDataProvider.ts
- backend/tests/monitoring/MarketMonitoringJob.test.ts
- backend/tests/monitoring/SqliteMarketDataProvider.test.ts

### Grupo 3 de TS-121

- backend/src/notifications/queue/application/SelectiveNotificationEnqueuer.ts
- backend/src/notifications/queue/infrastructure/SqliteNotificationQueueRepository.ts
- backend/tests/notifications/queue/NotificationQueue.test.ts

### Grupo 4 de integración

- backend/src/monitoring/infrastructure/createMarketMonitoringRuntime.ts
- backend/src/index.ts
- backend/.env.example
- backend/tests/sprint3/marketNotifications.integration.test.ts
- docs/SPRINT3_RENATO_US38_US39.md
