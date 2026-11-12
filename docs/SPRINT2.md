# Sprint 2: US21 y US24

Estado actualizado el 7 de noviembre de 2026: integración de `origin/main` en `3baf458c3548814d4fefa9f9ffec60871dfec818`, conservando registro, autenticación, recuperación, perfil, filtros y estado vacío junto con FSD y glosario. Ver [informe verificable de Sprint 1 y Sprint 2](INTEGRACION_SPRINTS1_2_MAIN.md). Las verificaciones fechadas anteriormente en este documento corresponden a la entrega original.

Rama: `feat/sprint2-us21-us24-completo`.
Directorio: `C:\Users\Magaz_\proyecto-software2\.worktrees\sprint2`.
Base independiente: `origin/main`, commit `8cc91626a456e03f52f83ae5e0e143dd6e2405de`, comprobado de nuevo mediante fetch el 4 de noviembre de 2026. No deriva del Sprint 1.

La revisión final del 4 de noviembre de 2026 conserva la implementación anterior y prepara su commit exclusivo de US21/US24. El usuario autorizó expresamente el commit y la publicación de esta rama. Revisa y ejecuta el Sprint desde este worktree; consulta el commit con `git log -1 --oneline` y su estado de publicación con `git status -sb`.

## Análisis, reutilización y dependencias

Se revisó `origin/feat/us21-us24-sprint2`. Se reutilizaron sus nombres de estados FSD, la fábrica de cobertura desconocida y la base visual/contenidos del glosario. Se adaptaron a los contratos actuales y las variables de estilo claro/oscuro del frontend. No se recuperó su endpoint separado de FSD, que volvía a leer cuentas y exigía otra petición desde la tabla: el atributo ahora viaja en las respuestas pertinentes existentes.

Se conservaron el repositorio JSON de ahorros, los productos ficticios de demostración, los filtros US17/US18, el semáforo US23 y los motores existentes. Los cambios en motores/calculadoras solo transportan metadatos FSD; las fórmulas, redondeos, ordenamientos y montos mínimos permanecen iguales, con pruebas de regresión aprobadas.

Los backlogs completos no estaban en los archivos del proyecto. Se aplicaron TS-63/64/65 y TS-74/75/76/77 de la solicitud. Se respetó `docs/us22-ts66.md`: no se implementó ni se inventó clasificación de solvencia. El semáforo preexistente todavía usa mocks y no demuestra cobertura FSD.

La pantalla de plazo fijo existente guarda parámetros temporalmente; no tiene tabla de resultados conectada a la API. Se añadió FSD a sus modelos y respuesta HTTP, pero la visualización FSD se integra en la tabla de ahorros que sí existe. Conectar una futura tabla de plazo fijo corresponde a la funcionalidad del equipo y puede reutilizar `IndicadorFSD`.

## US21: cobertura FSD

- `CuentaAhorros`, `FinancialProduct` y los resultados transportan `coberturaFSD`.
- Las APIs de ahorros y de simulación a plazo fijo devuelven el atributo.
- El indicador muestra texto e icono para `CUBIERTO`, `NO_CUBIERTO` y `NO_VERIFICADO`, con fuente y fechas cuando corresponda. No depende solo del color.
- Sin entidad, fuente oficial HTTPS, fecha de verificación válida y vigencia válida, el estado vuelve a `NO_VERIFICADO`. También se rechazan fechas futuras, evidencia vencida, dominios imitadores y datos mal formados. El frontend aplica una defensa equivalente antes de mostrar un estado confirmado.
- En plazo fijo se revalida al responder, incluso si el producto se cargó en memoria antes de vencer su evidencia.
- Los datos actuales no contienen evidencia: **todos quedan no verificados**. No se editó `backend/data/cuentas.json` ni se atribuyó protección a entidades ficticias.

Contrato:

```typescript
interface CoberturaFSD {
  entidadFinanciera: string | null;
  estado: "CUBIERTO" | "NO_CUBIERTO" | "NO_VERIFICADO";
  fechaVerificacion: string | null; // AAAA-MM-DD
  vigenteHasta: string | null;     // AAAA-MM-DD
  fuente: string | null;
}
```

Una URL oficial por sí sola no prueba cobertura. Un responsable debe revisar que la fuente corresponde a la entidad/producto y registrar el periodo de vigencia antes de añadir evidencia al repositorio. El código valida la integridad de esos metadatos; no descarga ni certifica automáticamente las fuentes. Los fixtures con estados confirmados son datos ficticios exclusivos de las pruebas. No deben copiarse al catálogo real. No se codificó ningún monto máximo de cobertura que pudiera quedar desactualizado.

## US24: glosario

Panel con diez conceptos, búsqueda insensible a tildes/mayúsculas, selección de definiciones y fuentes de SBS para FSD, TEA y TREA. Hay acceso general junto al formulario y enlaces contextuales en las cabeceras de capital inicial, interés, saldo final, riesgo, mantenimiento y FSD. Seleccionar un enlace abre su definición.

El panel se cierra con botón, Escape o fondo; contiene la navegación Tab/Shift+Tab, devuelve el foco al disparador y evita desplazar el fondo. Reabrirlo reinicia la búsqueda. Los estilos utilizan las variables existentes del proyecto.

Fuentes consultadas para la revisión del contenido el 3 de noviembre de 2026:

- [SBS: Fondo de Seguro de Depósitos](https://www.sbs.gob.pe/usuarios/aprende-con-la-sbs/fondo-de-seguro-de-depositos)
- [SBS: Depósitos](https://www.sbs.gob.pe/usuarios/informacion-financiera/depositos)
- [SBS: Domina tus finanzas](https://www.sbs.gob.pe/Portals/0/jer/mat_edu_finan/Jovenes%20y%20adultos/Guias/Domina-tus-finanzas.pdf)

Se aclara que la simulación no calcula TREA y que los cargos deben revisarse por separado. Estos conceptos no acreditan a ninguna entidad.

## Archivos

Modificados:

- `backend/src/rentabilidad/CuentaAhorros.ts`
- `backend/src/rentabilidad/FormateadorResultados.ts`
- `backend/src/rentabilidad/MotorCalculo.ts`
- `backend/src/rentabilidad/MotorCalculo.test.ts`
- `backend/src/rentabilidad/ResultadoFormateado.ts`
- `backend/src/rentabilidad/ResultadoRentabilidad.ts`
- `backend/src/repositorio/RepositorioCuentas.ts`
- `backend/src/simulation/domain/AtMaturityCalculator.ts`
- `backend/src/simulation/domain/FinancialProduct.ts`
- `backend/src/simulation/domain/MonthlyPaymentCalculator.ts`
- `backend/src/simulation/domain/SimulationResult.ts`
- `backend/src/simulation/interface/SimulationController.ts`
- `backend/tests/simulation/interface/SimulationController.test.ts`
- `frontend/src/App.tsx`
- `frontend/src/tabla_ahorros/TablaAhorrosView.tsx`
- `frontend/src/tabla_ahorros/columnas.ts`
- `frontend/src/tabla_ahorros/tipos.ts`

Creados:

- `backend/src/fsd/CoberturaFSD.ts`
- `backend/tests/fsd/fsd.test.ts`
- `frontend/src/fsd/IndicadorFSD.tsx`
- `frontend/src/fsd/IndicadorFSD.css`
- `frontend/src/fsd/IndicadorFSD.test.tsx`
- `frontend/src/glosario/GlosarioFinanciero.tsx`
- `frontend/src/glosario/GlosarioFinanciero.css`
- `frontend/src/glosario/GlosarioFinanciero.test.tsx`
- `frontend/src/glosario/terminos.ts`
- `frontend/src/tabla_ahorros/Sprint2.test.tsx`
- `docs/SPRINT2.md`

## Ejecutar en PowerShell

Las dependencias ya se instalaron con `npm.cmd ci`, sin dependencias nuevas ni cambios de lockfiles. Se dispone de Node.js 24.22.2 portátil en `.tools`, descargado del sitio oficial y verificado mediante SHA-256.

Terminal 1, backend:

```powershell
$repo = 'C:\Users\Magaz_\proyecto-software2'
$env:Path = "$repo\.tools\node-v24.22.2-win-x64;$env:Path"
Set-Location "$repo\.worktrees\sprint2\backend"
npm.cmd run dev
```

Terminal 2, frontend:

```powershell
$repo = 'C:\Users\Magaz_\proyecto-software2'
$env:Path = "$repo\.tools\node-v24.22.2-win-x64;$env:Path"
Set-Location "$repo\.worktrees\sprint2\frontend"
npm.cmd run dev
```

Abre `http://localhost:5173`. Backend: `http://localhost:3000`. Detén el Sprint 1 antes de usar estos mismos puertos. Si tienes Node 24 en el PATH, puedes omitir su asignación temporal. Para reinstalar dependencias, `npm.cmd ci` en cada carpeta.

Para ambos sprints a la vez, elige puertos diferentes en sus terminales: `$env:PORT = '3001'` para un backend, y `$env:VITE_API_URL = 'http://localhost:3001'` antes de `npm.cmd run dev -- --port 5174 --strictPort` para su frontend. No hace falta modificar archivos `.env`.

## Resultados reales

| Verificación | Resultado |
| --- | --- |
| Backend: test y coverage | 79 pruebas aprobadas, 8 archivos. |
| Frontend: test y coverage | 38 pruebas aprobadas, 6 archivos. |
| Build backend y frontend | Aprobado. |
| Lint backend | Aprobado. |
| Lint frontend con exclusión del reporte generado | Aprobado, sin advertencias. |
| Cobertura backend global, líneas (medida el 3/11; backend sin cambios en esta revisión) | 85,90 %; módulo FSD: 94,44 % líneas y 97,36 % ramas. |
| Cobertura frontend FSD/glosario | 97,61 % líneas, 100 % funciones, 93,22 % ramas. |
| Servidores arrancados el 4/11 | Health y frontend: HTTP 200; ahorros y las dos modalidades de plazo fijo mantienen FSD no verificado en los datos actuales. |

La revisión final amplió las pruebas de App: se visualizan los tres estados FSD usando fixtures, se conserva el atributo al filtrar y se accede al glosario desde el acceso general y desde ambos instrumentos. Las pruebas usan evidencia ficticia aislada; no cambian el catálogo de demostración.

Repite en cada carpeta:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint -- --ignore-pattern coverage
```

Backend: `npm.cmd run coverage`. Frontend, para incluir los módulos de este Sprint:

```powershell
npm.cmd test -- --coverage '--coverage.include=src/{fsd,glosario}/**'
```

El script de coverage habitual del frontend solo mide filtros. No se cambió esa configuración compartida. Al ejecutar lint después de generar coverage, la configuración preexistente incluye sus archivos JavaScript: aparecen tres advertencias de directivas eslint sin uso. La opción `--ignore-pattern coverage` evita analizar ese reporte generado sin excluir código fuente.

## Pruebas manuales pendientes

1. Abre el inicio y espera la tabla. Debe aparecer la columna FSD con estado no verificado para las cuentas actuales, sin afirmar que carecen de cobertura.
2. Comprueba que ordenar, filtrar mantenimiento/canales y abrir el semáforo siguen funcionando.
3. Selecciona el icono de consulta junto a la cabecera FSD. Debe abrirse directamente su definición.
4. Cierra con Escape: el foco debe volver al botón de esa cabecera. Abre Capital inicial o Interés y comprueba que cambia la definición correspondiente.
5. Abre el acceso general y busca `deposito`, `tea` y una palabra inexistente. Revisa búsqueda sin tildes, navegación y estado vacío.
6. Cambia de término dentro del panel. Recorre con Tab y Shift+Tab, cierra con botón y vuelve a abrir. Prueba también cerrar al pulsar el fondo.
7. Revisa en móvil y con tema claro/oscuro que el panel se pueda desplazar y cerrar. La tabla mantiene su contenedor de desplazamiento horizontal.

Los estados confirmado/sin cobertura se prueban automáticamente con fixtures aislados; no hace falta editar datos reales para demostrarlos. La revisión visual del 4/11 quedó bloqueada: Computer Use se detuvo porque no pudo determinar con suficiente confianza la URL actual de Chrome para aplicar su política. No se continuó la automatización del navegador. Sí se ejecutaron las pruebas de interacción con Testing Library/jsdom y las integraciones HTTP. La prueba HTTP dejó su resultado local en `.tools/review-final-zKGpmC/results.json` y cerró sus servidores al terminar.

## Revisar la entrega y su publicación

```powershell
Set-Location 'C:\Users\Magaz_\proyecto-software2\.worktrees\sprint2'
git branch --show-current
git status --short --untracked-files=all
git diff --check
git diff
```

Después del commit, consulta los cambios completos frente a la base y el historial:

```powershell
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
git log origin/main..HEAD --oneline
git ls-remote --heads origin refs/heads/feat/sprint2-us21-us24-completo
```

Destino autorizado: [rama del Sprint 2 en GitHub](https://github.com/trox-vevo/proyecto-software2/tree/feat/sprint2-us21-us24-completo). La publicación debe utilizar únicamente `git push -u origin feat/sprint2-us21-us24-completo`, sin force. El informe de la tarea confirma la subida y el hash resultante.

Main, las ramas anteriores y los datos locales se conservan. La restricción de integración de la entrega original fue sustituida el 7 de noviembre por autorización expresa para integrar `origin/main` dentro de Sprint 2, crear el commit y publicar esta rama mediante push normal. No se autoriza fusionar PR, activar auto-merge, modificar main o Sprint 3, reescribir historial, reset, clean ni crear otro PR. Para una copia nueva desde GitHub, instala Node 24 y ejecuta `npm.cmd ci` en backend y frontend; `.tools` es un recurso local excluido de Git.
