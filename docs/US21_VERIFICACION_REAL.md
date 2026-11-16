# US21: diagnóstico y corrección de la copia ejecutada

Verificación realizada el 16/11/2026, antes de la solicitud posterior de publicación. No se realizaron commits ni pushes durante la intervención sobre la copia ejecutada y su base real.

La aplicación que escuchaba en 3000 y 5173 se ejecutaba desde `C:\Users\Magaz_\Documents\proyecto-software2`, no desde `C:\Users\Magaz_\proyecto-software2`, donde se había implementado y probado la corrección anterior. Se confirmó mediante las líneas de ejecución y el directorio efectivo de ambos procesos.

El backend inicial no tenía DB_PATH ni USER_DB_PATH en su entorno ni configuración local de esas rutas. Con su directorio de trabajo `Documents\proyecto-software2\backend`, la ruta predeterminada resolvía a:

`C:\Users\Magaz_\Documents\proyecto-software2\backend\data\usuarios.sqlite`

Esa base aún contenía Entidad A–F y la evidencia ficticia antigua. No existía `savings_account_entities`. Su API devolvía seis resultados sin entityName/entityId y con cobertura no verificada. El frontend activo tampoco tenía la columna de entidad.

Se respaldaron los archivos afectados antes de trasladar únicamente la implementación FSD/US21 a esta copia. No se reemplazó el proyecto completo ni se incorporaron cambios ajenos de otras ramas. En index.ts solo se añadió la inspección de la migración; se conservó el resto de su composición.

Se ejecutaron realmente, en este orden:

1. `update-fsd-catalog.mjs --database <base real> --backup <respaldo FSD nuevo> --apply`: seis nombres y metadatos de FSD corregidos.
2. `link-savings-entities.mjs --database <base real> --backup <respaldo asociaciones nuevo> --apply`: tabla aditiva y seis asociaciones creadas.

Respaldos SQLite consistentes, conservados junto a la base:

- `usuarios.sqlite.fsd-before-real-fix-20261116.sqlite`
- `usuarios.sqlite.us21-before-links-20261116.sqlite`

Ambos se crearon antes de sus respectivas escrituras. Se verificaron hashes y cantidades de todas las tablas originales: excepto los nombres/metadatos de financial_entities autorizados, no cambiaron sus contenidos. Esto incluye savings_accounts, usuarios, favoritos, pagos y operaciones. Se repitió la comparación después de arrancar el backend y efectuar las comprobaciones HTTP.

Se iniciaron backend y frontend desde esta copia real. El backend queda explícitamente configurado con DB_PATH apuntando al archivo indicado, sin cambiar .env. La ruta http://localhost:5173/simular/ahorros responde HTTP 200 y Vite sirve la columna «Entidad financiera» actualizada.

La respuesta real de `http://localhost:3000/api/ahorros/rentabilidad`, ordenada aquí por cuenta, es:

| cuentaId | entityId | entityName | coberturaFSD.estado |
| --- | --- | --- | --- |
| AH-001 | 1 | Banco de Crédito del Perú (BCP) | CUBIERTO |
| AH-002 | 2 | BBVA Perú | CUBIERTO |
| AH-003 | 3 | Interbank | CUBIERTO |
| AH-004 | 4 | Scotiabank Perú | CUBIERTO |
| AH-005 | 5 | Cooperativa Abaco | NO_VERIFICADO |
| AH-006 | 6 | Cooperativa Pacífico | NO_VERIFICADO |

La evidencia conserva su consulta del 15/11/2026 y su revisión local hasta el 22/11/2026; no se inventaron fechas ni se afirma ausencia de protección FSDC para las cooperativas.

Se verificó el frontend con App y componentes reales de esta copia conectados al backend activo, sin sustituir fetch: los seis nombres y saldos de la API se renderizan; aparecen cuatro insignias verificadas y dos no verificadas y no aparece un banner académico. Esa comprobación y las tres pruebas de tabla sumaron cuatro casos aprobados. La prueba conectada se conserva como evidencia fuera de la suite ordinaria para no hacerla depender de un servidor en ejecución.

Las suites específicas de backend comprueban además lectura FSD, HTTP y migración en bases temporales. Los logs, la respuesta HTTP completa y los hashes de preservación quedan en `C:\Users\Magaz_\proyecto-software2\.tools\us21-ahorros-20261116`.

La comprobación visual en la ventana de Chrome se intentó pero Computer Use la bloqueó porque no pudo identificar la URL actual con suficiente confianza. Por eso no se declara una inspección visual manual completada: sí se verificaron los servidores HTTP y el renderizado de App contra la API real mediante Testing Library.

Posteriormente el usuario confirmó mediante revisión manual que las entidades ya aparecen en la aplicación.

Para futuras ejecuciones, iniciar el backend y frontend desde esta carpeta Documents. No mezclar terminales de ambas copias. La migración ya está aplicada: no hace falta repetirla ni reinicializar la base. Si queda una pestaña anterior, recargarla para obtener los módulos actualizados.
