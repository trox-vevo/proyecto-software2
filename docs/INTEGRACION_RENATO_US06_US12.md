# Integracion de US06 y US12

## Alcance y base

Rama feature/renato-us06-us12-integracion, worktree C:/Users/Renato/Documents/Codex/yupay-integracion. Base origin/main 04db854. La rama original y sus ocho cambios locales se conservaron. main local no se movio. No se publica esta rama.

## Arquitectura y flujo

App conserva RegistrationRoute y CommerceApp. FinanceApp entrega PlazoFijoView mediante una prop opcional de FormularioInversion. El selector de instrumento existente controla la visibilidad del modulo montado y conserva sus parametros al alternar ahorros/plazo fijo. El formulario anterior conserva su comportamiento para consumidores que no pasan esa prop.

US06 reutiliza frontend/src/plazo_fijo/FormularioPlazoFijo.tsx y usePlazoFijoController.ts. Captura monto decimal textual, departamento, modalidad y exactamente seis plazos (180, 360, 540, 720, 900, 1080). La validacion US07 existente intercepta montos inferiores a 500. Los cambios de parametros cancelan peticiones y retiran resultados anteriores.

POST /api/simulations/fixed-deposits recibe amount, department, termDays y paymentMode. api.ts consume JSON y conserva errores HTTP. Los estados React muestran carga y error. TablaResultadosPlazoFijo y columnas.ts presentan entidad, TEA, intereses y minimo. MONTHLY agrega la columna mensual. formato.ts presenta cadenas decimales sin recalcular intereses.

SimulationResult recibe minimumAmount opcional al FINAL del constructor para conservar la compatibilidad de channels y coberturaFSD. Ambos calculadores copian el minimo del producto; el controlador serializa dos decimales o null. Las formulas, redondeo y ordenamientos se conservan. El frontend admite null mediante un guion.

## Adaptaciones y autoria

Se extrajo exclusivamente el modulo plazo_fijo de origin/feature/renato-us06-us12 (7352485). Incluye aportes ajenos ya integrados en esa rama: validacion US07 (db8479b) y zero-state US13 (22e9f8b). Se reutilizan y se conservan como aportes del equipo. EmptyStateComponent existente en main se reutiliza sin modificaciones. No se copiaron App ni controladores antiguos y no hubo conflictos textuales de cherry-pick. La integracion manual resolvio el distinto constructor del modelo y el selector de instrumentos actual.

Se conservan autenticacion, registro, recuperacion, perfil, filtros, FSD, glosario, semaforo visual con sus datos mock, planes, favoritos y checkout del main actual. Sus suites forman parte de la verificacion. La presencia de mocks visuales no acredita un clasificador financiero.

## Cambios locales recuperados

Se incorporan etiquetas de suites, reporter verbose, package.json raiz y scripts/test-sprint-review.mjs, con estado TS-66 actualizado. README se adapta brevemente al proyecto actual. .test-results se excluye de Git. Se conserva el contenido remoto de las pruebas que incorporo US07/US13 en vez de reemplazarlo con pruebas antiguas. Se limita Vitest frontend a dos workers y un timeout de 15 segundos por la carga observada en Windows. Los originales permanecen intactos.

## US22 y UML

RiskLevel.ts, SolvencyIndicators.ts, RiskClassificationRules.ts y docs/us22-ts66.md se mantienen identicos a origin/main, incorporados mediante PR #5. TS-66 prepara contratos y propuestas, con indicadores y umbrales pendientes de aprobacion. TS-67, TS-68 y TS-69 quedan al equipo. No se implementa US23. No se encontraron archivos mdj versionados. La implementacion usa funciones y hooks React, y contratos TypeScript para riesgo. No se afirma la existencia de clases de evaluacion del UML.

## Verificacion

El comando npm test raiz termino con codigo 0. Frontend 237/237 pruebas, 25 archivos de pruebas. Backend 279/279 pruebas, 22 archivos. Cero pruebas fallidas u omitidas. US06 10 casos, US12 6, flujo US06/US12 7; se suman casos existentes de US07 y otras historias. Builds frontend y backend aprobados, ESLint frontend y backend aprobado. Las primeras pasadas detectaron saturacion de concurrencia, timeout de navegacion, mock HTTP reutilizado y codificacion de archivos modificados. Se corrigieron y la pasada completa final aprobo todas las comprobaciones.

No se realizo una inspeccion visual en navegador en esta entrega. La integracion real de frontend con Express y SQLite se ejecuto mediante la suite Sprint3.integration.test.tsx. La simulacion de plazo fijo se verifica con UI jsdom y tests HTTP reales de backend. npm ci reporto 11 vulnerabilidades en frontend (10 moderadas, 1 alta) y 12 en backend (11 moderadas, 1 alta), provenientes de los locks actuales. No se cambiaron dependencias mediante audit fix. Frontend incluye jsdom, HTTP simulado y suites existentes con Express y SQLite reales. Los tests no equivalen a aprobacion UX ni financiera.

## Commits

c961801 integra el modulo y el transporte del minimo. 4cf71ee adapta pruebas, codificacion y comando raiz. Los commits posteriores se consultan con git log origin/main..HEAD.

## Publicacion manual

Desde este worktree ejecutar git push -u origin feature/renato-us06-us12-integracion y abrir un PR hacia main. Estas operaciones quedan al usuario.
