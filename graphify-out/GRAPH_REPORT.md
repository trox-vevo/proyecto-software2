# Graph Report - proyecto-software2  (2026-11-16)

## Corpus Check
- 351 files · ~134,976 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 20, (none) 3, .example 1)

## Summary
- 2002 nodes · 5185 edges · 89 communities (85 shown, 4 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 145 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a40c8faf`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- FavoriteService.ts
- SbsRiskProfile
- ref_vitest
- ServiceChannels
- ReportController.integration.test.ts
- SqliteUserRepository
- session.ts
- passwordRecovery.test.ts
- Sprint 1: US01 y US02
- app.ts
- PaymentProcessing.test.ts
- react
- resultFilters.ts
- PerfilUsuario
- TablaAhorrosView.tsx
- userId
- QueueContracts.ts
- createMarketMonitoringRuntime.ts
- App.tsx
- automaticMarketAlerts.test.ts
- FixedDepositSimulationService
- IndicadorFSD.tsx
- decimal.js
- registration.test.ts
- NumericIdentifierMigration.ts
- UserRepository.ts
- SimuladorPage.tsx
- fetchWithAuth
- Checkout.tsx
- PdfKitGenerator.ts
- plazo_fijo/tipos.ts
- backend/package.json
- mockPayments.test.ts
- Favorite.ts
- SubscriptionMaintenanceRepository
- Resolución de conflictos de Sprint 1 y Sprint 2
- TablaResultadosPlazoFijo.tsx
- EnvioCorreo.ts
- AuthService.ts
- MonitorBloqueosUI
- index.ts
- Sprint 3 de Renato Almeyda
- compilerOptions
- SqliteFavoriteRepository.ts
- devDependencies
- frontend/package.json
- AlertasSeccion.test.tsx
- ServicioEnvioCorreo.ts
- ref_node_sqlite
- Justificación de las decisiones técnicas
- compilerOptions
- devDependencies
- ref_node_path
- integrationServer.ts
- export-schema.mjs
- RegistroEnvios
- plazo_fijo/columnas.ts
- favorites.test.ts
- servicioEnvioCorreo.test.ts
- Auditoría y corrección de identificadores de Yupay Finance
- compilerOptions
- RiskIndicatorsPanel.tsx
- smoke-api.mjs
- PlantillaCorreoAlerta.ts
- RiskClassificationRules.ts
- Sprint 3 de Yupay Finance
- Integracion de US06 y US12
- Integración de Sprint 3 con main — 7 de noviembre de 2026
- US22: preparación técnica de TS-66
- SavedSimulations.tsx
- test-sprint-review.mjs
- sprint3/numericIdentifiers.test.ts
- package.json
- eslint.config.js
- dependencies
- scripts
- AlertEvent
- Sprint 2 actualizado después del merge de Sprint 3
- Corrección de datos FSD — US21 y US35
- US32
- scripts
- GlosarioFinanciero.tsx
- update-fsd-catalog.mjs
- Sprint 3: favoritos, planes y checkout
- Salida final de comprobaciones Git
- React + TypeScript + Vite
- @vitejs/plugin-react
- dependencies
- frontend/tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `createApp()` - 73 edges
2. `decimal.js` - 51 edges
3. `SqliteUserRepository` - 49 edges
4. `ServiceChannels` - 41 edges
5. `@testing-library/react` - 41 edges
6. `react` - 40 edges
7. `fetchWithAuth()` - 40 edges
8. `App()` - 37 edges
9. `FinancialProduct` - 32 edges
10. `express` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Implementación y criterios` --references--> `createApp()`  [INFERRED]
  docs/SPRINT1.md → backend/src/app.ts
- `Matriz final de auditoría` --references--> `NewFavorite`  [INFERRED]
  docs/AUDITORIA_IDENTIFICADORES.md → backend/src/favorites/domain/Favorite.ts
- `Fechas y datos de demostración` --references--> `validarCoberturaFSD()`  [INFERRED]
  docs/CORRECCION_FSD.md → backend/src/fsd/CoberturaFSD.ts
- `Compatibilidad entre ramas sin fusionarlas` --references--> `userId()`  [INFERRED]
  docs/AUDITORIA_IDENTIFICADORES.md → backend/src/notifications/queue/domain/QueueValidation.ts
- `Planes y checkout` --references--> `userId()`  [INFERRED]
  docs/AUDITORIA_IDENTIFICADORES.md → backend/src/notifications/queue/domain/QueueValidation.ts

## Import Cycles
- None detected.

## Communities (89 total, 4 thin omitted)

### Community 0 - "FavoriteService.ts"
Cohesion: 0.08
Nodes (36): FavoriteParameters, AlgoritmoRentabilidad, CriterioOrden, FECHA, RENTABILIDAD, SALDO, CriteriosFiltro, FiltroAhorros (+28 more)

### Community 1 - "SbsRiskProfile"
Cohesion: 0.08
Nodes (22): EconomistReportService, RiskEvaluationService, EconomistReport, EconomistReportRepository, SbsRiskProfile, SbsRiskRepository, InformeJson, JsonEconomistReportRepository (+14 more)

### Community 2 - "ref_vitest"
Cohesion: 0.08
Nodes (21): App(), volverASimular(), abrir(), LIMA, renderAppWith(), catalog, favorite, goToCheckout() (+13 more)

### Community 3 - "ServiceChannels"
Cohesion: 0.10
Nodes (26): CoberturaFSD, crearCoberturaNoVerificada(), EstadoCoberturaFSD, fechaValida(), validarCoberturaFSD(), CuentaAhorros, DatosProducto, producto() (+18 more)

### Community 4 - "ReportController.integration.test.ts"
Cohesion: 0.07
Nodes (24): express-serve-static-core, Request, ProAccessMiddleware, getJwtSecret(), app, repository, service, users (+16 more)

### Community 5 - "SqliteUserRepository"
Cohesion: 0.08
Nodes (18): CheckoutPayment, isNotificationPreferences(), NotificationPreferences, NewRecoveryToken, numericIdentifier(), User, CheckoutPaymentRow, SqliteUserRepository (+10 more)

### Community 6 - "session.ts"
Cohesion: 0.09
Nodes (24): api(), Props, AUTH_SESSION_CHANGED_EVENT, AuthSession, clearAuthSession(), getStoredSession(), isAuthSession(), saveAuthSession() (+16 more)

### Community 7 - "passwordRecovery.test.ts"
Cohesion: 0.06
Nodes (18): PasswordRecoveryService, RecoveryEmailDeliveryError, RecoveryEmailService, InvalidNewPasswordError, InvalidRecoveryTokenError, PasswordResetService, scrypt, RecoveryTokenRepository (+10 more)

### Community 8 - "Sprint 1: US01 y US02"
Cohesion: 0.05
Nodes (40): Auditoría inicial y causa de los conflictos, Cambios encontrados en main, Decisiones y conservación de comportamiento, Dependencias y límites pendientes, Historial y alcance de publicación, Identificadores y persistencia, Incompatibilidad resuelta con decisión del usuario, Integración de main en Sprint 1 — 7 de noviembre de 2026 (+32 more)

### Community 9 - "app.ts"
Cohesion: 0.11
Nodes (27): ServicioAlertas, createAlertasRouter(), ResolverUsuarioId, createApp(), Sprint3Dependencies, supportsCheckoutPaymentHistory(), supportsNotificationPreferences(), supportsSubscriptionMaintenance() (+19 more)

### Community 10 - "PaymentProcessing.test.ts"
Cohesion: 0.09
Nodes (14): CheckoutController, CheckoutHistoryService, AuthenticationRequiredError, CheckoutHistoryUnavailableError, CheckoutPaymentHistoryRepository, CheckoutReceiptNotFoundError, PaymentGateway, PaymentResult (+6 more)

### Community 11 - "react"
Cohesion: 0.12
Nodes (24): Cabecera(), PRINCIPALES, GlosarioContext, Layout(), alHacerClic(), navegar(), useRuta(), useSesion() (+16 more)

### Community 12 - "resultFilters.ts"
Cohesion: 0.08
Nodes (30): DigitalChannelIcons(), getAccessibleLabel(), renderIcons(), Props, siNo(), AMBOS, NINGUNO, SOLO_APP (+22 more)

### Community 13 - "PerfilUsuario"
Cohesion: 0.11
Nodes (13): CorreoDuplicadoError, DatosPerfilInvalidosError, PerfilNoEncontradoError, ServicioPerfiles, PerfilUsuario, RepositorioPerfiles, RepositorioPerfilesJson, SqlitePerfilRepository (+5 more)

### Community 14 - "TablaAhorrosView.tsx"
Cohesion: 0.13
Nodes (27): FavoriteButton(), save(), InstantaneaVista, CONFIG_NIVELES, CONFIG_SIN_CLASIFICAR, ConfigNivel, obtenerConfig(), PanelDescripcionRiesgo() (+19 more)

### Community 15 - "userId"
Cohesion: 0.14
Nodes (13): MarketSnapshot, changeDemoRate(), NotificationFrequency, NotificationQueueRepository, QueuedNotification, QueueInput, frequency(), isoDate() (+5 more)

### Community 16 - "QueueContracts.ts"
Cohesion: 0.12
Nodes (14): AutorizadorEnvioPro, ProAccessService, DEFAULT_NOTIFICATION_PREFERENCES, InvalidNotificationPreferencesError, NOTIFICATION_FREQUENCIES, NOTIFICATION_TYPES, NotificationPreferencesRepository, NotificationType (+6 more)

### Community 17 - "createMarketMonitoringRuntime.ts"
Cohesion: 0.14
Nodes (20): MarketMonitoringJob, monitoringInterval(), MonitoringCycleService, CycleResult, MarketChangePublisher, MarketDataProvider, MarketVariationDetector, MonitoringConfiguration (+12 more)

### Community 18 - "App.tsx"
Cohesion: 0.10
Nodes (21): Replay, catalogo, favoritoPlazoFijo, iniciarSesion(), CancellationResult, CancelSubscriptionSection(), cancelSubscription(), isCancellationResult() (+13 more)

### Community 19 - "automaticMarketAlerts.test.ts"
Cohesion: 0.10
Nodes (21): aAlerta(), leerCobertura(), NO_VERIFICADO, seguro(), texto(), AlertaApi, CoberturaFSD, EstadoFSD (+13 more)

### Community 20 - "FixedDepositSimulationService"
Cohesion: 0.10
Nodes (14): FixedDepositSimulationService, InvalidSimulationParametersError, RiskRatingFilter, PaymentMode, AT_MATURITY, MONTHLY, AMOUNT_FORMAT, isPaymentMode() (+6 more)

### Community 21 - "IndicadorFSD.tsx"
Cohesion: 0.12
Nodes (20): Pruebas de la entrega original, 3 y 4 de noviembre, Comprobaciones de la pasarela DEMO, ALERTAS_MOCK, NO_VERIFICADA, AlertasSeccion(), ContadorPendientes(), NotificacionVisual(), Props (+12 more)

### Community 22 - "decimal.js"
Cohesion: 0.14
Nodes (15): SolvencyIndicator, SolvencyIndicators, ALLOWED_TERM_DAYS, MINIMUM_OPENING_AMOUNT, AtMaturityCalculator, FinancialProduct, InterestCalculator, MonthlyPaymentCalculator (+7 more)

### Community 23 - "registration.test.ts"
Cohesion: 0.09
Nodes (14): InvalidRegistrationError, RegistrationInput, RegistrationService, scrypt, NewUser, PublicUser, DuplicateEmailError, UserRepository (+6 more)

### Community 24 - "NumericIdentifierMigration.ts"
Cohesion: 0.13
Nodes (22): runNumericMigration(), canonical(), checkIntegrity(), createSchema(), destinationPath(), fail(), IdKind, inspect() (+14 more)

### Community 25 - "UserRepository.ts"
Cohesion: 0.13
Nodes (12): hasProAccess(), AuthenticationRequiredError, CancellationConfirmation, RenewalPaymentFailureNotApplicableError, SubscriptionHistoryUnavailableError, SubscriptionNotActiveError, SubscriptionService, SubscriptionStatus (+4 more)

### Community 26 - "SimuladorPage.tsx"
Cohesion: 0.10
Nodes (19): useAbrirGlosario(), applyFilters(), ResultFiltersPanel(), DEPARTAMENTOS, FormularioInversion(), ParametrosAhorro, ParametrosPlazoFijo, PLAZOS_DIAS (+11 more)

### Community 27 - "fetchWithAuth"
Cohesion: 0.12
Nodes (23): fetchWithAuth(), BillingHistory(), downloadReceipt(), BillingTransaction, isBillingHistory(), isBillingTransaction(), RiskBadge(), handleClick() (+15 more)

### Community 28 - "Checkout.tsx"
Cohesion: 0.12
Nodes (24): Checkout(), clearForm(), leaveCheckout(), paymentDetails(), showDecline(), showSuccess(), submitPayment(), updateCard() (+16 more)

### Community 29 - "PdfKitGenerator.ts"
Cohesion: 0.14
Nodes (10): PdfGenerator, SolvencyReportService, SolvencyReport, Column, LOGO, MODE_LABEL, money(), PdfKitGenerator (+2 more)

### Community 30 - "plazo_fijo/tipos.ts"
Cohesion: 0.16
Nodes (18): simularPlazoFijo(), DEPARTAMENTOS, FormularioPlazoFijo(), enviar(), Props, Flujo(), iniciales, esModalidadPago() (+10 more)

### Community 31 - "backend/package.json"
Cohesion: 0.08
Nodes (24): author, description, eslint, @eslint/js, globals, @types/node, typescript, typescript-eslint (+16 more)

### Community 32 - "mockPayments.test.ts"
Cohesion: 0.13
Nodes (17): BillingErrors, validateBilling(), DemoScenarioId, InvalidMockPaymentError, MockPaymentResult, MockPaymentService, readScenario(), Plan (+9 more)

### Community 33 - "Favorite.ts"
Cohesion: 0.19
Nodes (12): FavoriteService, invalid(), readParameters(), AuthenticatedUser, FavoriteError, FavoriteRepository, isEntityId(), ResolveUser (+4 more)

### Community 34 - "SubscriptionMaintenanceRepository"
Cohesion: 0.15
Nodes (8): PlanChangeEmailService, startSubscriptionMaintenanceJob(), SubscriptionMaintenanceLogger, SubscriptionMaintenanceService, PlanChangeReason, SubscriptionMaintenanceRepository, SmtpPlanChangeEmailService, nodemailer

### Community 35 - "Resolución de conflictos de Sprint 1 y Sprint 2"
Cohesion: 0.09
Nodes (21): Auditoría previa, Comandos para auditoría posterior, Contratos y datos, De main, Del Sprint 2, Dependencias y pendientes, Historial y publicación permitida, Implementaciones conservadas (+13 more)

### Community 36 - "TablaResultadosPlazoFijo.tsx"
Cohesion: 0.16
Nodes (15): Sprint 2: conflicto exacto y causa, obtenerColumnas(), Props, TablaResultadosPlazoFijo(), ModalidadPago, EconomistReportModal(), close(), open() (+7 more)

### Community 37 - "EnvioCorreo.ts"
Cohesion: 0.15
Nodes (11): DependenciasEnvio, AutorizadorEnvio, BuscadorUsuarios, ContenidoCorreo, ProveedorCorreo, ResolvedorAlertaCorreo, SmtpCorreoAlertas, ProveedorFalso (+3 more)

### Community 38 - "AuthService.ts"
Cohesion: 0.15
Nodes (7): AuthService, InvalidCredentialsError, scrypt, PublicSession, Session, InMemorySessionRepository, UserPlan

### Community 39 - "MonitorBloqueosUI"
Cohesion: 0.17
Nodes (9): BloqueoDetectado, MonitorBloqueosUI, ETIQUETAS, Props, EventoBloqueo, TipoBloqueo, VistaObservable, leerUmbral() (+1 more)

### Community 40 - "index.ts"
Cohesion: 0.12
Nodes (14): AlertEmailJobLogger, startAlertEmailJob(), Temporizador, TemporizadorReal, app, database, favorites, marketConfiguration (+6 more)

### Community 41 - "Sprint 3 de Renato Almeyda"
Cohesion: 0.10
Nodes (18): Configuración, Demostración con la aplicación, Flujo implementado, Integración automática de alertas de mercado, Pruebas, Publicación, Alcance y base, Composición y configuración (+10 more)

### Community 42 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 43 - "SqliteFavoriteRepository.ts"
Cohesion: 0.18
Nodes (11): Favorite, NewFavorite, ColumnInfo, readEntityId(), SqliteFavoriteRepository, API ampliada para US29, Auditoría y corrección de identificadores del 6 de noviembre de 2026, Persistencia relacional (+3 more)

### Community 44 - "devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, jsdom, @testing-library/jest-dom (+11 more)

### Community 45 - "frontend/package.json"
Cohesion: 0.11
Nodes (17): eslint, @eslint/js, globals, @types/node, typescript, typescript-eslint, vitest, @vitest/coverage-v8 (+9 more)

### Community 46 - "AlertasSeccion.test.tsx"
Cohesion: 0.16
Nodes (8): simularApi(), ALERTAS_MOCK, alertasMock(), NO_VERIFICADA, guardarIdPendiente(), idDesdeUrl(), leerIdPendiente(), useAlertas()

### Community 47 - "ServicioEnvioCorreo.ts"
Cohesion: 0.21
Nodes (5): PoliticaReintentos, describirError(), OpcionesEnvio, ResultadoEnvio, ServicioEnvioCorreo

### Community 48 - "ref_node_sqlite"
Cohesion: 0.16
Nodes (10): agregarColumnasProductoAhorro(), openDatabase(), SQL_DIR, baseline, dbDir, directories, excluidos, keys (+2 more)

### Community 49 - "Justificación de las decisiones técnicas"
Cohesion: 0.12
Nodes (17): 10. Sprint 2 sin cambios artificiales, 11. Detección del esquema anterior antes de escribir, 12. Migración hacia respaldo y salida nuevos, 13. Correspondencia estable, preservación literal y esquema admitido, 14. Compatibilidad comprobada sin fusionar ramas, 15. Pruebas y documentación del cambio contractual, 16. Alcance de historias y conservación local, 1. Contrato numérico de extremo a extremo (+9 more)

### Community 50 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 51 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, @eslint/js, globals, tsx, @types/cors, @types/express, @types/jsonwebtoken (+8 more)

### Community 52 - "ref_node_path"
Cohesion: 0.21
Nodes (5): assertNumericDatabase(), directories, PRODUCTOS, perfilJson, directory

### Community 53 - "integrationServer.ts"
Cohesion: 0.12
Nodes (14): createFavoriteUserResolver(), createUser(), directory, favorites, file, products, server, tokens (+6 more)

### Community 54 - "export-schema.mjs"
Cohesion: 0.12
Nodes (11): directories, root, script, body, database, dbFile, header, root (+3 more)

### Community 55 - "RegistroEnvios"
Cohesion: 0.19
Nodes (4): IntentoEnvio, RegistroEnvios, ConsolaRegistroEnvios, RegistroEnMemoria

### Community 56 - "plazo_fijo/columnas.ts"
Cohesion: 0.22
Nodes (8): COLUMNA_MENSUAL, ColumnaPlazoFijo, COLUMNAS, decimalVisible(), formatearImporte(), formatearTasa(), resultado, COLUMNAS

### Community 57 - "favorites.test.ts"
Cohesion: 0.15
Nodes (11): accounts, channels, directory, file, fixture, products, repository, savings (+3 more)

### Community 58 - "servicioEnvioCorreo.test.ts"
Cohesion: 0.23
Nodes (7): ColaCorreo, AHORA, ALERTA, ColaFalsa, crear(), notificacion(), TemporizadorFalso

### Community 59 - "Auditoría y corrección de identificadores de Yupay Finance"
Cohesion: 0.17
Nodes (12): Auditoría y corrección de identificadores de Yupay Finance, Clasificación de identificadores, Compatibilidad entre ramas sin fusionarlas, Estado de Git al finalizar la auditoría de identificadores, Estado inicial y alcance de Git, Incidencias resueltas durante las verificaciones, Matriz final de auditoría, Pendientes reales (+4 more)

### Community 60 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, outDir, rootDir, skipLibCheck, strict (+2 more)

### Community 61 - "RiskIndicatorsPanel.tsx"
Cohesion: 0.35
Nodes (7): nivelDeCalificacion(), formatearFecha(), formatPercent(), Props, RiskIndicatorsPanel(), renderIndicators(), SbsRiskProfile

### Community 62 - "smoke-api.mjs"
Cohesion: 0.20
Nodes (6): backendDir, DYNAMIC_KEYS, EXPECTED_CHANGES, normalize(), root, run()

### Community 63 - "PlantillaCorreoAlerta.ts"
Cohesion: 0.33
Nodes (7): enUnaLinea(), escaparHtml(), ESCAPES, PlantillaCorreoAlerta, DatosAlertaCorreo, alertaDeRiesgo, alertaDeTasa

### Community 64 - "RiskClassificationRules.ts"
Cohesion: 0.24
Nodes (8): IndicatorRequirement, RiskClassificationRules, RiskCondition, RiskPolicyApproval, RiskLevel, AMARILLO, ROJO, VERDE

### Community 65 - "Sprint 3 de Yupay Finance"
Cohesion: 0.20
Nodes (7): Archivos de la entrega, Comprobaciones del 4 de noviembre de 2026, Demostración desde la aplicación, Ejecutar con PowerShell, Estado de la entrega local, Sprint 3 de Yupay Finance, US31

### Community 66 - "Integracion de US06 y US12"
Cohesion: 0.20
Nodes (9): Adaptaciones y autoria, Alcance y base, Arquitectura y flujo, Cambios locales recuperados, Commits, Integracion de US06 y US12, Publicacion manual, US22 y UML (+1 more)

### Community 67 - "Integración de Sprint 3 con main — 7 de noviembre de 2026"
Cohesion: 0.20
Nodes (10): Auditoría inicial, Comprobaciones reproducibles, Conflictos exactos y resolución, Contratos conservados, Git y publicación, Integración de Sprint 3 con main — 7 de noviembre de 2026, Pendientes y futuras integraciones, Protección de SQLite (+2 more)

### Community 68 - "US22: preparación técnica de TS-66"
Cohesion: 0.20
Nodes (9): Adaptación de los diagramas StarUML, Base y verificación, Contratos propuestos, Decisiones pendientes de aprobación, Estado y responsabilidad, Integración futura y JSON, Plan de pruebas para TS-69, Semántica propuesta para acordar con TS-67 (+1 more)

### Community 69 - "SavedSimulations.tsx"
Cohesion: 0.36
Nodes (9): Favorite, favoriteAmount(), FavoriteParameters, favoriteTitle(), isFavorite(), isParameters(), SavedSimulations(), deleteFavorite() (+1 more)

### Community 70 - "test-sprint-review.mjs"
Cohesion: 0.20
Nodes (8): assertions, environment, failed, groups, resultsDirectory, root, steps, temporaryDirectory

### Community 71 - "sprint3/numericIdentifiers.test.ts"
Cohesion: 0.22
Nodes (6): accounts, directories, pending, products, savings, simulation

### Community 72 - "package.json"
Cohesion: 0.22
Nodes (8): engines, node, name, private, scripts, build, start, test

### Community 74 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, cors, decimal.js, dotenv, express, jsonwebtoken, nodemailer, pdfkit

### Community 75 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, coverage, dev, lint, market:demo, start, test

### Community 77 - "Sprint 2 actualizado después del merge de Sprint 3"
Cohesion: 0.25
Nodes (7): Comportamientos preservados, Conflictos exactos y causas, Estado inicial y referencias, Git, aislamiento y pendientes, Prueba de convivencia añadida, Sprint 2 actualizado después del merge de Sprint 3, Verificación completa

### Community 78 - "Corrección de datos FSD — US21 y US35"
Cohesion: 0.25
Nodes (7): Aplicación manual a una base existente, Archivos y campos modificados, Comprobación posterior para publicar el Pull Request, Corrección de datos FSD — US21 y US35, Entidades y evidencia, Fechas y datos de demostración, Preservación y comprobaciones

### Community 79 - "US32"
Cohesion: 0.25
Nodes (8): Archivos de esta ampliación de US32, Archivos del ajuste a formato numérico libre, Componentes ampliados y decisiones, Decisión académica y flujo completo, Endpoint de simulación, Formato libre de datos ficticios, Integración con US33 y límites, US32

### Community 80 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, coverage, dev, lint, preview, test

### Community 81 - "GlosarioFinanciero.tsx"
Cohesion: 0.33
Nodes (4): PanelGlosario(), Props, TERMINO_POR_COLUMNA, TERMINOS

### Community 82 - "update-fsd-catalog.mjs"
Cohesion: 0.43
Nodes (6): coverageFor(), encoded(), entries, revision, updateCatalog(), validate()

### Community 83 - "Sprint 3: favoritos, planes y checkout"
Cohesion: 0.50
Nodes (4): Archivos corregidos sobre la entrega local previa, Favoritos, Planes y checkout, Sprint 3: favoritos, planes y checkout

### Community 84 - "Salida final de comprobaciones Git"
Cohesion: 0.50
Nodes (4): Salida final de comprobaciones Git, sprint1, sprint2, sprint3

### Community 85 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 87 - "dependencies"
Cohesion: 0.67
Nodes (3): dependencies, react, react-dom

## Knowledge Gaps
- **566 isolated node(s):** `name`, `version`, `main`, `market:demo`, `test` (+561 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 765 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApp()` connect `app.ts` to `FavoriteService.ts`, `SbsRiskProfile`, `ServiceChannels`, `ReportController.integration.test.ts`, `passwordRecovery.test.ts`, `Sprint 1: US01 y US02`, `PaymentProcessing.test.ts`, `PerfilUsuario`, `QueueContracts.ts`, `automaticMarketAlerts.test.ts`, `FixedDepositSimulationService`, `registration.test.ts`, `UserRepository.ts`, `PdfKitGenerator.ts`, `mockPayments.test.ts`, `Favorite.ts`, `AuthService.ts`, `index.ts`, `ref_node_sqlite`, `ref_node_path`, `integrationServer.ts`, `favorites.test.ts`, `sprint3/numericIdentifiers.test.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `createApp()` (e.g. with `optionalAuthMiddleware()` and `.actualizar()`) actually correct?**
  _`createApp()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `main` to the rest of the system?**
  _566 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FavoriteService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07553143374038897 - nodes in this community are weakly interconnected._
- **Why does `decimal.js` connect `decimal.js` to `FavoriteService.ts`, `RiskClassificationRules.ts`, `SbsRiskProfile`, `ServiceChannels`, `ReportController.integration.test.ts`, `SqliteUserRepository`, `userId`, `createMarketMonitoringRuntime.ts`, `automaticMarketAlerts.test.ts`, `FixedDepositSimulationService`, `favorites.test.ts`, `PdfKitGenerator.ts`, `backend/package.json`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `SbsRiskProfile` be split into smaller, more focused modules?**
  _Cohesion score 0.07832080200501253 - nodes in this community are weakly interconnected._
- **Why does `userId()` connect `userId` to `SqliteUserRepository`, `passwordRecovery.test.ts`, `Sprint 1: US01 y US02`, `PaymentProcessing.test.ts`, `QueueContracts.ts`, `Sprint 3: favoritos, planes y checkout`, `Auditoría y corrección de identificadores de Yupay Finance`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._