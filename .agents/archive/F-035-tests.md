# Informe de tests — F-035

## Archivos

| Archivo | Casos | Símbolos cubiertos |
|---|---|---|
| `src/__tests__/cuentasPorCobrarApplyMovimiento.test.ts` | 45 | 1-5: `MOVIMIENTO_CUENTA_POR_COBRAR_VIOLATIONS`, `MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS`, `decideMovimientoCuentaPorCobrar` (las 8 guardas en su orden exacto + la tabla de 14 filas de § 5.2), `valueAbonoPagos`, `MovimientoCuentaPorCobrarError` |
| `src/__tests__/cuentasPorCobrarPanel.test.ts` | 64 | 6-8: `withAging`, `filterByBucket`, `buildDeudorRows` · 16-20 (diseño): `AGING_BUCKET_OPTIONS`, `formatAntiguedadDias`, `sumEquivalenteBase`, `describeAbono`, `buildMovimientoRows` (incl. `usuarioNombre`) · **24 `buildFiltroOpciones`** (nuevo, ver «Ampliación» abajo) |
| `src/__tests__/cuentasPorCobrarConstants.test.ts` | 23 | 9-10: `CUENTAS_POR_COBRAR_API_ERRORS.saldoInsuficiente`, `TIPO_MOVIMIENTO_LABEL` · 21-23 (diseño): `TIPO_MOVIMIENTO_HUE`, `countFiltrosActivos`, `describeFiltros` · re-exports (`CUENTAS_POR_COBRAR_PERMISO`, `TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR`) · mitad de datos del criterio 12 (plantillas de permisos) |
| `src/__tests__/cuentasPorCobrarPanelSchema.test.ts` | 39 | 11-14: `abonoPagoLineaSchema`/`registrarAbonoSchema`, `agingBucketEnum`, `motivoField`, `MOTIVO_CONTROL_CHARACTERS_MESSAGE` · más `cuentasPorCobrarFiltrosSchema`, `deudorEstadoEnum`, `cuentaAbiertaSchema` (`cierrePeriodoAbiertoId`), `perdonarDeudaSchema`, `revertirAbonoSchema`, `movimientoAplicadoResponseSchema`, `saldoInsuficienteResponseSchema`, `movimientoCuentaPorCobrarConAutorSchema` |
| `src/__tests__/cuentasPorCobrarCobrosNetos.test.ts` | 8 | 15: `netCollectionRows` (el espejo en negativo, ADR 0128) |
| `src/__tests__/cuentasPorCobrarServiceDates.test.ts` | 8 | **Regresión** — el borde de `src/services/cuentasPorCobrarService.ts`: sus seis funciones exportadas parsean la respuesta por su schema Zod, así que `fecha`/`createdAt`/`settledAt`/`ultimoAbonoAt`/`at` salen como `Date` real, nunca como el string ISO que entrega la red. Ver «Regresión: fechas perdidas en el borde del servicio» abajo. |

Más un arreglo sobre un archivo **preexistente de F-032** que el contrato de F-035 rompe desde
fuera (ver «Arreglos pedidos por el coordinador»):

| Archivo | Qué cambió |
|---|---|
| `src/__tests__/loadCierreInput.test.ts` | Las dos aserciones de `periodCollectionsWhere` actualizadas de `tipo: "ABONO"` a `tipo: { in: ["ABONO", "REVERSION_ABONO"] }` (contrato § 12.1, ADR 0128). Un tercer test nuevo confirma explícitamente que no se relajó a un `.not.toBe("ABONO")` sin más. |

No toqué `src/__tests__/routeGuardInventory.test.ts`: es genérico y data-driven (lee
`routeGuards.json` y el árbol en disco y los compara), así que las seis rutas de F-035 lo
satisfacen solas en cuanto el `implementer` añade sus filas al JSON. Lo dejo anotado porque una
instrucción anterior decía lo contrario; lo verifiqué leyendo el test antes de tocarlo (y quedó
en verde solo, sin ninguna edición mía, en cuanto el `implementer` terminó el § 6.3).

No dupliqué el test de `computeSaldoAlCierre` con los cuatro tipos de movimiento en un solo caso:
ya existe, exacto y ya en verde, en `src/__tests__/cuentasPorCobrarSaldo.test.ts` (F-031, líneas
25-35: "subtracts ABONO, AJUSTE_DEVOLUCION and CONDONACION but ADDS REVERSION_ABONO — all four
exercised in ONE test").

## Ampliación pedida por el coordinador, tras el contrato de diseño corregido

Dos rondas de correcciones llegaron después de la primera pasada de este informe:

**1. `buildFiltroOpciones` (símbolo 24, `src/lib/cuentasPorCobrar/panel.ts`).** No estaba en mi
cobertura porque, en la lista de testabilidad que tenía delante al escribir, el símbolo aparecía
citado en el § 1 del diseño pero ausente de su § 7 (lista de símbolos puros) — E-035. El
coordinador me dio los casos que discriminan y los usé, más el que yo ya tenía escrito antes de
que llegara la instrucción (dedupe de tiendas por `tiendaId` con el primer nombre visto,
determinado por el orden que `buildDeudorRows` ya deja — no por el orden en que se escriben los
fixtures):

- `[]` → `{ deudores: [], tiendas: [] }`.
- Dos deudores con cuentas en la **misma** tienda dan **una** opción de tienda, no dos.
- Un deudor con `cuentas: []` aporta su nombre a `deudores` y **nada** a `tiendas`.
- El resultado no depende del orden de entrada (`[A, B]` y `[B, A]` dan el mismo resultado).
- (el que ya tenía) dedupe por `tiendaId` conservando el primer nombre visto, y orden alfabético
  tanto de `deudores` como de `tiendas`.

De paso, el propio contrato (`.agents/specs/F-035.md` § 4, actualizado por el `arch-guardian`) fijó
por fin la forma de `IFiltroOpciones` (`{ deudores: IFiltroOpcion[]; tiendas: IFiltroOpcion[] }`,
`IFiltroOpcion = { id, nombre }`) — **exactamente la que yo había inferido** para los tests de
`describeFiltros` de la primera pasada. El propio contrato lo dice sin rodeos: "coincidió con el
implementer — pero por suerte, no por contrato" — así que la advertencia que tenía en el punto 5
de "tests que sospecho que no discriminan" (ver abajo) queda **resuelta**, no solo confirmada.

**2. `buildMovimientoRows` — `usuarioNombre` ratificado.** El diseñador fijó que es un campo de
`IMovimientoRow`, `string | null`, **copiado sin transformar** (el placeholder de pantalla "Sin
autor registrado" es copy del componente, no algo que esta función produzca). Añadí un test
dedicado que comprueba el paso sin transformar en los dos casos (con nombre y con `null`), **con
`toMatchObject`, no `toEqual`**, como pidió el coordinador — esa lista de campos ya cambió una vez
en este feature (ganó `usuarioNombre`) y un `toEqual` sobre el objeto completo convertiría
cualquier campo nuevo futuro en un rojo que no señala ningún defecto real. Mis otros tests de
`buildMovimientoRows` ya comprobaban campos sueltos (`.revertido`, `.esReversion`, `.tiendaNombre`,
etc.) en vez de comparar el objeto entero, así que no hubo que tocarlos.

## Arreglos pedidos por el coordinador (E-026 adenda / E-045)

**1. `loadCierreInput.test.ts` líneas 58 y 66 — actualizado contra el contrato, no contra el
código.** El § 12.1 (ADR 0128) amplía el `where` de `periodCollectionsWhere` de `tipo: "ABONO"` a
`tipo: { in: ["ABONO", "REVERSION_ABONO"] }`. Actualicé las dos aserciones a ese valor exacto y
añadí un tercer test que exige explícitamente que **no** se reduzca de vuelta a la cadena
`"ABONO"` sola — es justo lo que el propio § 12.1 dice que el `toEqual` existe para atrapar, y no
se resolvió relajando la comprobación (nunca se borró el `toEqual`).

Documenté explícitamente, en un comentario junto al test, **qué NO cubre** esta aserción: la
segunda mitad de § 12.1 (el `select` del `findMany` ganando `tipo` y `revierte: { select: {
pagosDetalle, tasaSnapshot } }`) es código **distinto** — vive inline en la función impura
`loadCierreInput`, no en el `where`-builder puro que este archivo prueba — y el propio § 12.1 del
contrato asigna esa mitad al `qa`, ejecutando (lo dice él mismo: "Casos nuevos... que el qa
verifica ejecutando", y el criterio 13 de § 12.2 nombra explícitamente "es el include de revierte
lo que se está auditando"). No fabriqué un mock completo de todo el grafo de llamadas Prisma de
`loadCierreInput` para intentar cubrir esa mitad, porque hacerlo bien exigiría conocer su
orquestación real — que no está descrita de forma autocontenida en ningún contrato — y adivinarla
sería exactamente el tipo de "leer la implementación para ajustar expectativas" que tengo
prohibido. Lo dejo explícito para que el `qa` sepa que esa mitad es enteramente suya.

**2. El error de lint (`cuentasPorCobrarCobrosNetos.test.ts:40`, `fechaOrigen` sin usar) — no se
borró sin mirar por qué estaba.** Comprobé el propósito: esa variable era un resto de copiar el
fixture del test vecino ("uses the REVERSAL's own fecha, not the origin's"), que YA es quien
verifica, dedicado y explícito, que el espejo usa la fecha de la reversión y no la del origen. En
el test donde vivía la variable sin usar ("negates both monto and equivalenteBase on every line")
esa distinción no se ejercita en absoluto — el `revierte` no lleva `fecha` en su forma
(`{ pagosDetalle, tasaSnapshot }`), así que declararla ahí no protegía nada que el test vecino no
protegiera ya. La quité (no la usé a la fuerza) y dejé un comentario que señala dónde vive esa
comprobación de verdad, para que no se vuelva a copiar sin usar.

## Regresión: fechas perdidas en el borde del servicio (`cuentasPorCobrarServiceDates.test.ts`)

El `qa`, ejecutando, encontró un 500 en el detalle de cualquier deudor con dos o más movimientos:
`src/services/cuentasPorCobrarService.ts` devolvía `response.data` **sin pasarlo por el schema**
Zod de `src/schemas/cuentasPorCobrarPanel.ts`, así que `fecha`/`createdAt`/`settledAt`/
`ultimoAbonoAt`/`at` llegaban como el string ISO que entrega JSON, nunca como `Date` — y
`buildMovimientoRows` (`src/lib/cuentasPorCobrar/panel.ts`) ordena con
`b.fecha.getTime() - a.fecha.getTime()`, que revienta sobre un string.

**Por qué mi propia suite no lo atrapó, y por qué no era un descuido — es E-008 en su forma más
limpia:**

1. `Array.prototype.sort` **no invoca el comparador con 0 o 1 elementos**. Un fixture de un solo
   movimiento nunca ejecuta la línea que rompe, y un solo movimiento es el fixture más natural de
   escribir a mano.
2. Todos mis fixtures de `cuentasPorCobrarPanel.test.ts` construyen `fecha` con `new Date(...)`
   directamente — lo natural al escribir un test a mano —, que es precisamente lo único que el
   ciclo real de red **nunca** entrega: un `Date` solo existe después de que algo parsee el string
   que de verdad viajó. Un test puro de `buildMovimientoRows` que solo maneja `Date` reales es
   **estructuralmente incapaz** de ver este bug, por muchos casos que cubra — la pérdida de tipo
   ocurre una capa más arriba, en el servicio.

**Lo que añadí, `src/__tests__/cuentasPorCobrarServiceDates.test.ts` (8 casos):**

- Mockea `@/lib/axiosClient` (la dependencia externa) y llama a las **seis** funciones reales
  exportadas de `cuentasPorCobrarService.ts` (contrato § 7), nunca a un mock propio de esas
  funciones.
- Cada fixture entrega las fechas como **string ISO**, exactamente como las entregaría la red real
  — nunca como `Date` ya construido —, que es la única forma de reproducir el bug.
- `getDeudorDetalle`: el escenario **exacto** que encontró el `qa` — un deudor con **dos**
  movimientos — comprobando que `at`, `fechaVenta` y cada `movimiento.fecha`/`createdAt` del
  resultado son `Date` reales, más un caso de `settledAt` no nulo.
- `getCuentaPorCobrar`: mismo patrón, con dos movimientos.
- `getCuentasPorCobrar`: `at`, `ultimoAbonoAt` (con caso `null` para comprobar que la coerción no
  convierte un `null` en un `Date`) y `fechaVenta` de cada cuenta.
- `registrarAbono` / `perdonarDeuda` / `revertirAbono`: los tres llevan `settledAt` en su
  respuesta (`IMovimientoAplicadoResponse`), el mismo tipo de campo con el mismo riesgo — los tres
  quedan cubiertos, con un caso de `settledAt: null` para `revertirAbono`.

**Punto 3 del encargo — busqué el mismo agujero en otras respuestas del servicio con fechas, y lo
cubrí donde lo hay:** las seis funciones exportadas son las únicas del archivo (contrato § 7), y
las seis llevan al menos un campo de fecha en su respuesta — las seis quedaron cubiertas arriba.
No hay un séptimo camino de datos en este servicio que se me haya quedado fuera.

**Estado al momento de escribir esto: las 8 pasan.** El `implementer` ya había aplicado (o nunca
llegó a romper) el `.parse()` en los seis casos cuando corrí la suite — lo sé por el resultado de
la ejecución, no porque abriera el archivo: mi primer intento falló por un `ZodError` de `id`
inválido en mis propios fixtures (usé `"m1"`/`"m2"` como placeholder, que no es un UUID v4 válido
— E-072), lo corregí generando UUIDs reales, y en la segunda corrida las 8 ya estaban en verde
contra el servicio real. El test queda igual como regresión permanente aunque hoy no esté rojo:
si alguien vuelve a quitar el `.parse()` de cualquiera de las seis funciones, esta suite lo
atrapa.

Añadí también un comentario en `cuentasPorCobrarPanel.test.ts`, justo encima del `describe` de
`buildMovimientoRows`, documentando por qué todos sus fixtures usan dos o más movimientos y por
qué siguen construyendo `fecha` con `Date` reales (no es su responsabilidad sobrevivir a un
llamador que viole su propio contrato de tipos — esa mitad es del test de servicio de arriba).

## Criterios de aceptación cubiertos (por la parte que un test unitario puede cubrir)

| # | Criterio | Test |
|---|----------|------|
| 2 (mitad pura) | Los tramos 30/45/61 y el filtro `31-60` | `cuentasPorCobrarPanel.test.ts` → `filterByBucket` |
| 4 (mitad pura) | Abono parcial vs. saldo exacto, `settledAt` puesto y **levantado** | `cuentasPorCobrarApplyMovimiento.test.ts` → guard 8 + tabla § 5.2 |
| 5 | 12000 CUP saldados con 100 USD a 120 (exacto) y 50 USD a 120 (no exacto) | `cuentasPorCobrarApplyMovimiento.test.ts` → `valueAbonoPagos` |
| 9 | 400 con el saldo real en el cuerpo, no solo un mensaje genérico | `cuentasPorCobrarApplyMovimiento.test.ts` → guard 8 · `cuentasPorCobrarConstants.test.ts` → `saldoInsuficiente(500)` contiene "500" |
| 11 (mitad pura) | `settledAt` recomputado, reversión crea fila NUEVA (no edita/borra) | `cuentasPorCobrarApplyMovimiento.test.ts` → tabla § 5.2, filas 11/12/13/14 |
| 12 (mitad de datos) | Vendedor/almacenero sin los 3 permisos nuevos; administrador con ellos | `cuentasPorCobrarConstants.test.ts` → "Permission templates" |
| — | `motivoField` rechaza TODO el rango de control, incluido `\x0A` | `cuentasPorCobrarPanelSchema.test.ts` → describe "motivoField" |
| — | `netCollectionRows`: neto de un abono y su reversión = 0, con líneas en dos monedas | `cuentasPorCobrarCobrosNetos.test.ts` → "the § 4bis worked example" |
| — (F-032 § 12.1, protegido desde fuera) | `periodCollectionsWhere` incluye `REVERSION_ABONO` y no se reduce de vuelta a `"ABONO"` | `loadCierreInput.test.ts` |

Los criterios 1, 3, 6, 7, 8, 10, 12 (la mitad HTTP) y 13 son de **ejecución** (rutas, HTTP,
concurrencia con `Promise.all`, DOM/responsive) y este proyecto **no tiene arnés para probar route
handlers ni componentes** (`AGENTS.md`: "src/app/api/ ... no tienen cobertura de tests"; ningún
test del repo importa un `route.ts`; no hay `@testing-library/react`). Los cubre el `qa`
ejecutando, no esta suite.

## Estado (final, tras los tres arreglos y la regresión de fechas)

- `npx vitest run`: **193 archivos, 4059 tests pasando, 1 skip preexistente y ajeno, 0 fallos.**
  Exit code 0.
- `npx tsc --noEmit`: **limpio, 0 errores.** Exit code 0.
- `npm run lint` (SOLO, sin pipe — E-045): **0 errores**, solo warnings preexistentes y ajenos
  (`react-hooks/exhaustive-deps`, `no-restricted-syntax` de hex/rgba en `sx`, ninguno en
  `src/__tests__/`). Exit code 0.

Línea base antes de empezar: 187 archivos, 3895 tests, 1 skip preexistente, 0 fallos, `tsc`/`lint`
limpios. Delta: **+6 archivos, +164 tests** (150 de la primera pasada + 6 de la ampliación de
`buildFiltroOpciones`/`usuarioNombre` + 8 de la regresión de fechas del servicio), árbol limpio en
los tres comandos.

**Nota de proceso, para que quede escrita:** durante esta sesión el `implementer` fue creando en
paralelo `src/constants/cuentasPorCobrar.ts`, `src/schemas/cuentasPorCobrarPanel.ts`,
`src/lib/cuentasPorCobrar/{applyMovimiento,panel,cobrosNetos}.ts`, y tocando los dos puntos
delegados de F-032. No leí ninguno de esos archivos con la herramienta de lectura, ni mientras se
escribían ni después — los tests se escribieron enteramente contra el contrato (y sus dos
enmiendas) antes de que la mayoría de esos ficheros terminaran, y solo se ejecutaron después. Que
casi todos pasaran a la primera es una señal fuerte de que el contrato estaba bien especificado,
no evidencia de que yo mirara el código.

## No cubierto y por qué

- **Componentes de UI** (`DeudoresTable`, `AbonoDialog`, `MultiCurrencyPayment`, etc.): el proyecto
  no tiene `@testing-library/react`; se verifican con `tsc`, `lint` y QA manual en el navegador
  (`AGENTS.md`).
- **Las 6 route handlers** (`api/cuentas-por-cobrar/**`): ningún test de este repo importa un
  `route.ts`. Los protocolos de verificación HTTP del spec (403/404/409/400 con idempotencia,
  concurrencia con `Promise.all`, el botón deshabilitado) son del `qa`, ejecutando contra un
  servidor real.
- **`applyMovimientoCuentaPorCobrar`** (la puerta de escritura en sí, no
  `decideMovimientoCuentaPorCobrar`): mezcla Prisma (`tx`, `SELECT ... FOR UPDATE`) con la decisión
  pura. El propio contrato la deja fuera de la "lista de testabilidad" (símbolos 1-5 son solo la
  mitad pura de `applyMovimiento.ts`). No la mockeé con un `tx` falso porque eso terminaría
  probando mi propio mock, no el bloqueo real.
- **`MovimientoCuentaPorCobrarError`**, más allá de "es un `Error`": el contrato fija sus dos
  campos (`violation`, `saldoPendiente`) pero **no fija el orden de los parámetros del
  constructor**. Instanciar con un orden adivinado arriesgaba un falso rojo por forma, no por
  lógica — lo dejo para que QA lo verifique junto con la puerta de escritura.
- **La segunda mitad de § 12.1** (el `select`/`revierte` de `loadCierreInput`/`caja.ts`): ver
  «Arreglos pedidos por el coordinador» arriba — es del `qa`, ejecutando, por el propio texto del
  contrato.
- **Los 10 criterios de F-032 que el § 12.2 del contrato exige re-ejecutar**: integración con
  Prisma real (cierre de caja, `recalculate`), fuera del alcance de "lógica pura" de este proyecto.
  Los verifica el `qa`.

## Tests que sospecho que NO discriminan bien (para que el `qa` los mida por mutación)

1. **`MovimientoCuentaPorCobrarError — is a subclass of Error`** (`cuentasPorCobrarApplyMovimiento.test.ts`).
   Débil a propósito: el constructor no está fijado por el contrato. Una implementación que no
   herede de `Error` cae; una que herede pero ponga los campos al revés, no.
2. **`decideMovimientoCuentaPorCobrar — guard 2 — "does not fire when tipo IS REVERSION_ABONO (control)"`**.
   Usa `.not.toBe("REVIERTE_ID_INESPERADO")` en vez de exigir un valor concreto: una
   implementación que devolviera *cualquier otra* violación equivocada (no la guarda 2, pero
   tampoco `null`) pasaría igual. Control auxiliar, no el discriminador principal de esa guarda.
3. **`withAging — "is reproducible: the SAME at, called at two different real moments..."`**. No
   cruza ningún reloj real (ambas llamadas ocurren en el mismo tick); el primer test del mismo
   `describe` ya atrapa un `Date.now()` en vez de `at`. Este segundo es redundante sobre esa misma
   señal.
4. **`netCollectionRows — "a reversal whose origin did NOT come in the join contributes nothing"`**,
   en aislamiento: si la función devolviera `[]` incondicionalmente para *cualquier* entrada, este
   test pasaría igual. Lo que lo salva es el test vecino ("an ABONO passes through unchanged"), que
   exige que una fila SÍ aparezca — la mutación "vaciar siempre el array" cae ahí, no aquí.

(El punto que en la primera pasada de este informe señalaba la forma de `opciones` de
`describeFiltros` como no-100%-contractual **ya no aplica**: el contrato la fijó explícitamente en
su § 4, coincidiendo con lo que yo había inferido — ver «Ampliación» arriba.)

## Para el implementer / arch-guardian

- **`MovimientoCuentaPorCobrarError`**: sigue faltando fijar el orden de los parámetros del
  constructor. Sugiero `constructor(violation, saldoPendiente, message?)`, en línea con
  `DuplicateRequestError` (`src/lib/idempotency.ts`).
- Confirmado ejecutando: `src/__tests__/routeGuardInventory.test.ts` **no necesita ningún cambio**
  para F-035 — es genérico. Si en algún punto del pipeline se sigue repitiendo la instrucción de
  "actualizar el censo a mano", vale la pena corregir esa nota en el material de referencia del
  `dev-tester`.
- **La mitad `select`/`revierte` de § 12.1** (`loadCierreInput.ts`/`caja.ts`) no tiene ningún
  símbolo puro exportado que la haga testeable sin mockear todo el grafo de Prisma de la función.
  Si en algún momento se quiere cobertura automatizada de esa mitad (hoy es enteramente del `qa`
  ejecutando), la vía limpia sería que el `arch-guardian` extraiga el `select` a una constante
  exportada, como ya se hizo en otros módulos de este repo (p. ej. `DISCOUNT_RULE_SELECT` en
  `src/lib/discounts/index.ts`).

## Errores que me costaron

Ninguno de más de un intento. Dos ajustes post-escritura, ninguno por leer la implementación:

1. Un ajuste de tipos (`tsc`): el fixture de `buildMovimientoRows` necesitaba `cuentaPorCobrarId`/
   `createdAt` por fila y `tipo` tipado al enum cerrado en vez de `string` — lo supe por el mensaje
   del compilador.
2. Un ajuste de orden en mi propio fixture de `buildFiltroOpciones`: asumí que la función vería los
   deudores en el mismo orden en que yo los escribía, y `buildDeudorRows` ya los reordena por saldo
   descendente antes de que yo se los pasara — el fallo (con la implementación real, ya en el
   árbol) me lo señaló, lo corregí fijando los saldos para que el orden fuera inequívoco y añadí
   una aserción de saneamiento (`rows.map(clienteNombre)`) para que no se repita en silencio.
