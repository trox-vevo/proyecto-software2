# Integración automática de alertas de mercado

Esta corrección completa la detección TS-117 y el cruce TS-120 que faltaban para alimentar la cola TS-121. Se realizó por la nueva solicitud de integrar el flujo completo. Conserva el job, la cola, la API de alertas y el consumidor de correos aportados anteriormente por el equipo.

## Flujo implementado

1. El job lee el catálogo SQLite local. El monitoreo queda habilitado por defecto; una variable explícita false permite desactivarlo.
2. SqliteMarketVariationDetector establece una referencia en la primera lectura, sin avisar cambios históricos. En los ciclos siguientes compara TEA con decimal.js y detecta cambios de calificación cuando hay valor anterior y actual. Una ausencia temporal de calificación conserva la última válida. Ignora observaciones anteriores a la ya procesada.
3. La referencia, una revisión incremental y los eventos pendientes se guardan en una transacción. Los eventos mantienen su identificador al reintentar. La revisión permite distinguir una subida, bajada y nueva subida al mismo valor.
4. SqliteAlertMatchingService busca los usuarios que guardaron productos de la entidad en favoritos de plazo fijo. Comprueba Pro vigente y preferencias. Los favoritos de ahorro actuales carecen de relación explícita con financial_entities, por lo que no se les inventa una correspondencia.
5. La cola revalida permisos, persiste sin duplicados y conserva la frecuencia. El cruce programa RESUMEN_DIARIO a la siguiente medianoche UTC. La agrupación y entrega del resumen continúan pendientes; el consumidor existente procesa INMEDIATA.
6. Solo después de publicar todos los eventos se confirman en market_change_outbox. Un fallo entre publicación y confirmación repite eventos con los mismos identificadores y la cola los deduplica. La referencia y el outbox sobreviven a un reinicio.
7. La API existente muestra las alertas inmediatas. La pantalla refresca cada 15 segundos y al volver a la ventana, sin superponer consultas ni sobrescribir el marcado de lectura con respuestas atrasadas.
8. US40 consume la misma cola si ALERT_EMAIL_JOB_ENABLED=true y SMTP está configurado. La prueba del flujo usa el servicio real con un proveedor de correo simulado. No se enviaron correos reales durante la verificación.

## Configuración

```dotenv
MARKET_MONITORING_ENABLED=true
MARKET_MONITORING_INTERVAL_MS=60000
MARKET_RATE_CHANGE_THRESHOLD=0
MARKET_DEMO_ENABLED=false
```

El umbral representa la diferencia absoluta de TEA como fracción, con comparación estrictamente mayor. Por ejemplo, 0.005 equivale a 0.5 puntos porcentuales; un cambio exactamente igual al umbral no genera evento. Se eligió 0 como valor operativo por defecto para avisar cualquier cambio distinto de cero. Es configurable y no acredita una política financiera aprobada. Se compara cada observación válida con la anterior; las variaciones menores al umbral no se acumulan.

Si el .env anterior contiene MARKET_MONITORING_ENABLED=false, cambiarlo explícitamente para activar el monitoreo. No se modifican los .env locales ni secretos del usuario.

La fuente sigue siendo el catálogo local de demostración. Esta integración detecta actualizaciones de la base; no obtiene tasas en vivo de SBS o de bancos. Una base sin cambios conserva sus valores sin producir alertas artificiales. Las tablas nuevas son market_monitoring_baseline y market_change_outbox. No se modifican las tablas existentes de usuarios y favoritos.

## Demostración con la aplicación

Usar una copia de la base actual realizada con el servidor detenido. Desde backend, el ejemplo siguiente asume que la base actual está en data/usuarios.sqlite.

```powershell
Copy-Item .\data\usuarios.sqlite .\data\demo-alertas.sqlite
$env:DB_PATH = "data/demo-alertas.sqlite"
$env:MARKET_MONITORING_ENABLED = "true"
$env:MARKET_MONITORING_INTERVAL_MS = "1000"
npm run dev
```

Ingresar con una cuenta Pro vigente de esa copia, guardar un depósito de la entidad 1 en favoritos y habilitar CAMBIO_TASA con frecuencia INMEDIATA en las preferencias. Esperar al menos un ciclo para establecer la referencia.

En otra terminal, desde el mismo directorio backend

```powershell
$env:DB_PATH = "data/demo-alertas.sqlite"
$env:MARKET_DEMO_ENABLED = "true"
npm run market:demo -- 1 0.081234
```

El segundo argumento es una TEA fraccionaria. Debe ser diferente de la actual. El comando modifica únicamente la tasa del producto indicado en la base explícita. Se rechaza su uso con NODE_ENV=production o sin autorización de demo y DB_PATH. No crea usuarios ni activa planes. La alerta aparecerá tras el ciclo y la actualización de pantalla. Puede verse antes al volver a enfocar la ventana. El correo requiere habilitar el job y configurar SMTP por separado.

## Pruebas

El test automaticMarketAlerts usa el temporizador, detector, cruce, favoritos, usuarios, preferencias, SQLite, API y servicio US40 reales. Solo simula la identidad HTTP de la petición de prueba y el proveedor de correo. Comprueba filtros, resumen diario, precisión, umbral, riesgo, oscilaciones, reinicio y recuperación tras fallos. Los tests frontend verifican refresco y coordinación con escritura de lectura.

La regresión final sobre f823cf1 terminó con código 0 mediante npm test desde la raíz.

| Comprobación | Aprobadas | Fallidas |
| --- | --- | --- |
| Suite frontend | 376 | 0 |
| Suite backend | 485 | 0 |
| Total | 861 | 0 |

Ambos builds y ambos linters aprobaron. Los 12 casos del nuevo test backend y los 3 del refresco frontend también se ejecutaron en pruebas específicas. No se omitieron pruebas. El flujo completo se comprobó por API real y SQLite, con proveedor de correo simulado. No se realizó inspección visual del navegador.

Durante la regresión se corrigieron expectativas preexistentes: la paridad del catálogo incorporó la evidencia FSD del seed vigente, y tres archivos de integración frontend pasaron a usar el enlace Inicio después de que el PR #29 retirara el botón anterior. Se mantuvieron sus comprobaciones funcionales y los nuevos tests de perfil del equipo. Un error de tipado en ese ajuste se corrigió y la ejecución final completa aprobó todos los pasos. Los informes JSON y el log permanecen en .test-results, excluido de Git.

## Publicación

Rama fix/alertas-mercado-integracion basada en origin/main f823cf1. Durante el trabajo entró el PR #29 y se adelantó la base de esta rama sin crear commits de código. La reaplicación conservó las nuevas pruebas y correcciones de perfil y facturación del equipo. Se conserva un respaldo stash identificado como backup-alertas-antes-actualizar-main. Las ramas anteriores se conservaron. Los cambios quedan sin confirmar ni publicar para que el usuario pueda revisar y ejecutar los comandos entregados.
