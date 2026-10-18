# Sprint 1: US06 y US12

## Alcance implementado

US06 captura monto, departamento, modalidad y plazo en `frontend/src/plazo_fijo/FormularioPlazoFijo.tsx`.
El selector permite exclusivamente 180, 360, 540, 720, 900 y 1080 días. El monto se conserva
como texto decimal y las modalidades usan los identificadores `AT_MATURITY` y `MONTHLY`.
TS-20 se resuelve con estado React en `usePlazoFijoController`: se conserva mientras el flujo
permanece montado, incluso al alternar entre ahorros y plazo fijo. Recargar la página lo reinicia.
No se añade base de datos ni almacenamiento persistente.

US12 usa columnas declarativas en `columnas.ts`, siguiendo el patrón de `tabla_ahorros`.
Incluye Entidad, Tasa (TEA), Intereses Totales y Monto Mínimo de Cuenta. Solo `MONTHLY`
incluye **Intereses Mensuales (Aproximado)**. React presenta los valores recibidos; no calcula
rentabilidad. El formato decimal opera sobre cadenas y conserva los centavos incluso cuando
el importe excede la precisión de Number.

Al editar cualquier parámetro se retiran los resultados anteriores y se cancela la solicitud
pendiente. Las respuestas tardías canceladas no pueden reemplazar la nueva consulta.
Los errores conservan los parámetros para corregir o reintentar. La sección de ahorros y su
monitor permanecen disponibles desde dos botones en App, sin añadir un enrutador.

## Contrato de integración

`POST /api/simulations/fixed-deposits` (endpoint existente de US10):

```json
{"amount":"1000.00","termDays":360,"department":"Lima","paymentMode":"AT_MATURITY"}
```

Respuesta: arreglo ordenado por el backend, sin cambiar su orden en React.
Ejemplo del catálogo de demostración existente, no una oferta financiera real:

```json
[
  {
    "productId": 2,
    "entityName": "Caja Huancayo",
    "tea": "0.0575",
    "totalInterest": "57.50",
    "monthlyInterest": null,
    "minimumAmount": "1000.00"
  }
]
```

`minimumAmount` es la única ampliación del JSON: se copia de FinancialProduct a
SimulationResult en ambas estrategias y se serializa con dos decimales. No se modifican
las fórmulas de US10 ni las validaciones de US07. El constructor de SimulationResult
ahora requiere minimumAmount como sexto argumento; los dos sitios existentes están adaptados.
Coordinar este campo y el constructor con quien implemente TS-68.

`api.ts` es un adaptador mínimo para US08, que no tenía un módulo reutilizable de plazo fijo
en main. Usa la misma variable `VITE_API_URL` que ahorros, con `http://localhost:3000` por defecto.
La API devuelve errores de negocio con HTTP 400 y `message`; la UI los presenta.
No había una pantalla compartida US13: se muestra solo un mensaje breve para `[]`.

## Validación

Desde backend: `npm ci`, `npm test`, `npm run build`, `npm run lint`.
Desde frontend: `npm ci`, `npm test`, `npm run build`, `npm run lint`.

- Backend: 55 pruebas aprobadas, incluyendo ahorro, ambos cálculos, servicio y HTTP real.
- Frontend: 22 pruebas aprobadas en tres archivos de `src/plazo_fijo`.
- Compilación de ambas partes y ESLint aprobados.
- Se recorrió la aplicación local en navegador: ahorros, formulario, simulación al vencimiento,
  simulación mensual, cambio de modalidad, rechazo de 499.99 y consulta sin productos en Tacna.
- Se inspeccionó visualmente la tabla mensual y se ajustó el salto de línea de sus encabezados.
- La aprobación UX formal de TS-21 y la correspondencia con ofertas vigentes siguen pendientes
  del equipo. No se declara aprobación financiera ni QA de todos los navegadores o dispositivos.

Las dependencias nuevas son solo de desarrollo: Vitest ejecuta las pruebas, jsdom proporciona
el DOM, Testing Library React y user-event permiten probar interacciones accesibles, y
jest-dom aporta aserciones del DOM. No se añadieron bibliotecas visuales ni dependencias de producción.

En el entorno aislado Windows de esta ejecución fue necesario dirigir TEMP y TMP a una carpeta
de trabajo accesible para que los workers de Vitest compartieran sus archivos temporales.
Esto fue una configuración de los comandos de verificación, no del proyecto.

## Correcciones previas necesarias

Main (`67f740b`) no compilaba el backend: ResultadoFormateado.ts estaba vacío y MotorCalculo
declaraba `string[]` aunque devuelve objetos. Se restauró el tipo de esos objetos sin modificar
la lógica de ahorros. Vitest también encontraba los tests CommonJS emitidos en dist después
de compilar; su configuración ahora descubre los tests fuente de src y tests, conservando
los cinco archivos originales. Estas correcciones están en un commit separado.

## Correspondencia con UML y coordinación

- FormularioPlazoFijo corresponde al componente React del mismo nombre.
- PlazoFijoController y la coordinación de PlazoFijoService se adaptan al hook y al adaptador HTTP.
- El repositorio de parámetros propuesto por UML se reemplaza por estado React, según TS-20.
- MotorCalculoPlazoFijo corresponde al FixedDepositSimulationService y sus estrategias ya existentes.
- TablaResultadosPlazoFijo corresponde al componente y a la configuración declarativa de columnas.
- Los nombres españoles de DTO y modalidades se adaptan al contrato inglés existente.
- El `montoFinal` propuesto por UML no se muestra porque el endpoint no lo devuelve; no se calcula
  en React. Se incorpora minimumAmount, que sí existe en el producto.
- El catálogo actual solo tiene productos de ejemplo para Lima, Arequipa y Cusco. La UI identifica
  explícitamente la demostración. El resto de ubicaciones puede retornar un arreglo vacío.
- El PDF suministrado tiene responsables y estados históricos distintos del encargo actual.
  No se actualizaron esos documentos ni se marcaron tareas como aprobadas por sus responsables.
- La rama de US22 se limita a TS-66 por confirmación del usuario; riskLevel todavía no forma
  parte de la respuesta. TS-67, TS-68, TS-69 y la UI US23 siguen a cargo del equipo.

## Archivos

Creados: `frontend/src/plazo_fijo/` (formulario, tipos, tabla, columnas, formato, adaptador,
hook, vista y sus tres archivos de tests), `frontend/src/test/setup.ts`, `frontend/vitest.config.ts`
y este documento.

Modificados: App.tsx, App.css, package.json y package-lock.json del frontend, tsconfig.node.json;
SimulationResult, ambas calculadoras, SimulationController y sus pruebas del backend;
MotorCalculo, ResultadoFormateado y vitest.config.mts para reparar los bloqueos previos.
