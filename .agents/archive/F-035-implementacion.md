# F-035 — Informe de implementación (`implementer`)

**Fecha:** 2026-09-10
**Contrato:** `.agents/specs/F-035.md` §§ 370-1858 (versión enmendada del 2026-09-09)
**Diseño:** `.agents/designs/F-035.md` (versión actualizada tras la enmienda)
**Frontera respetada:** solo `src/**`. **No se tocó `src/__tests__/**`**, ni `.agents/**` (salvo
este archivo, que es el mío), ni `docs/adr/**`.

---

## Verificación

| Comando | Exit | Nota |
|---|---|---|
| `npx tsc --noEmit` | **0** | limpio |
| `npm run lint` (corrido **solo**, sin pipe — E-045) | **1** | **el único `Error:` está en `src/__tests__/cuentasPorCobrarCobrosNetos.test.ts:40` (`'fechaOrigen' is assigned a value but never used`), que es del `dev-tester`.** Ninguno de mis archivos añade error ni warning nuevo |
| `npx vitest run` | **1** | 192 archivos, 4042 pasan, **2 fallan**, 1 skip preexistente. Los dos fallos son de `src/__tests__/loadCierreInput.test.ts` y son **consecuencia esperada de la delegación del § 12** — ver abajo |

### Los dos tests que fallan, y por qué no los toco

`src/__tests__/loadCierreInput.test.ts:58` y `:66` afirman
`periodCollectionsWhere(...) toEqual({ tipo: "ABONO", ... })`. El **§ 12.1 del contrato** ordena
literalmente cambiar ese `where` a `tipo: { in: ["ABONO", "REVERSION_ABONO"] }` (ADR 0128). El test
es preexistente, de F-032, y **vive en la frontera del `dev-tester`**: no lo edito (E-046). Hay que
actualizarlo para que afirme la cláusula nueva.

Es exactamente la adenda de **E-026**: `tsc` y `lint` limpios en mi lado y la suite en rojo porque
un cambio mío rompe desde fuera un test que no escribí.

### Línea base

La del `progress` era 187 archivos / 3895 tests. Ahora son 192 / 4045: los cinco archivos nuevos
son del `dev-tester` (`cuentasPorCobrarApplyMovimiento`, `cuentasPorCobrarPanel`,
`cuentasPorCobrarPanelSchema`, `cuentasPorCobrarConstants`, `cuentasPorCobrarCobrosNetos`) y **los
cinco pasan contra mi implementación**, lo que además descarta un ciclo de valor (E-028) en los
módulos nuevos.

---

## Archivos creados

| Archivo | Qué hace |
|---|---|
| `src/schemas/cuentasPorCobrarPanel.ts` | Los schemas Zod del feature, `motivoField` con `MOTIVO_CONTROL_CHARACTERS_MESSAGE` propio, y los tipos `I*` derivados |
| `src/constants/cuentasPorCobrar.ts` | Permisos, `TIPO_MOVIMIENTO_LABEL`, `TIPO_MOVIMIENTO_HUE`, `CUENTAS_POR_COBRAR_API_ERRORS`, `CUENTAS_POR_COBRAR_COPY`, `CUENTAS_POR_COBRAR_DOM`, `SIN_DENOMINACIONES`, `countFiltrosActivos`, `describeFiltros` |
| `src/lib/cuentasPorCobrar/applyMovimiento.ts` | La **única** puerta de escritura del libro: `lockCuentaPorCobrar`, `decideMovimientoCuentaPorCobrar`, `valueAbonoPagos`, `applyMovimientoCuentaPorCobrar`, `MovimientoCuentaPorCobrarError` y las dos tablas de vocabulario |
| `src/lib/cuentasPorCobrar/panel.ts` | Agregación pura: `withAging`, `filterByBucket`, `buildDeudorRows`, `AGING_BUCKET_OPTIONS`, `formatAntiguedadDias`, `sumEquivalenteBase`, `describeAbono`, `buildMovimientoRows`, `buildFiltroOpciones` |
| `src/lib/cuentasPorCobrar/cobrosNetos.ts` | `netCollectionRows`: el espejo en negativo del ADR 0128 |
| `src/services/cuentasPorCobrarService.ts` | Las seis llamadas Axios, sin ninguna regla |
| `src/app/api/cuentas-por-cobrar/route.ts` | GET listado |
| `src/app/api/cuentas-por-cobrar/[cuentaId]/route.ts` | GET detalle de cuenta |
| `src/app/api/cuentas-por-cobrar/cliente/[clienteId]/route.ts` | GET detalle del deudor, con la venta ya mapeada por `mapVentaToIVenta` |
| `src/app/api/cuentas-por-cobrar/[cuentaId]/abono/route.ts` | POST cobro |
| `src/app/api/cuentas-por-cobrar/[cuentaId]/perdonar/route.ts` | POST perdón |
| `src/app/api/cuentas-por-cobrar/[cuentaId]/reversion/route.ts` | POST reversión |
| `src/app/cuentas-por-cobrar/page.tsx` | El panel de deudores |
| `src/app/cuentas-por-cobrar/[clienteId]/page.tsx` | El detalle del deudor |
| `src/app/cuentas-por-cobrar/components/FiltrosDeudores.tsx` | Los cuatro filtros y su diálogo (< 600 px) |
| `src/app/cuentas-por-cobrar/components/DeudoresMobileList.tsx` | Tarjetas a < 600 px |
| `src/app/cuentas-por-cobrar/components/DeudoresTable.tsx` | Tabla a ≥ 600 px, 7ª columna y teléfono a ≥ 900 px |
| `src/app/cuentas-por-cobrar/components/CuentaCard.tsx` | Una venta fiada y sus acciones |
| `src/app/cuentas-por-cobrar/components/MovimientosLibro.tsx` | El libro, con el autor y el pill `Revertido` |
| `src/app/cuentas-por-cobrar/components/AbonoDialog.tsx` | El cobro multimoneda |
| `src/app/cuentas-por-cobrar/components/PerdonarDeudaDialog.tsx` | El perdón |
| `src/app/cuentas-por-cobrar/components/RevertirAbonoDialog.tsx` | La reversión |

## Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/components/MultiCurrencyPayment/MultiCurrencyPayment.tsx` | `allowChange` y `showShortfall` (§ 8.1); `formatMontoEnMoneda` en lugar de los siete `toFixed(2)` de dinero (§ 8.2); fuera el `size="small"` de `FormControl`, `MoneyField`, `Button` e `IconButton` (§ 8.3). `todasMonedas` **no se tocó** |
| `src/lib/cierre/loadCierreInput.ts` | **Solo los dos puntos del § 12.1**: `periodCollectionsWhere` (filtro + comentario reescrito) y el `select`/`map` de `abonos`, que ahora pasa por `netCollectionRows` |
| `src/lib/movimiento/caja.ts` | **Solo el punto del § 12.1**: la carga de abonos de `construirResumenCajaAbierta` (where + select + `netCollectionRows` antes de las tres llamadas a `buildResumenMonedas`). `buildResumenMonedas` y `valueAbonos` **no se tocaron** |
| `src/constants/permisos/permisos.json` | Tres filas nuevas, **insertadas antes** de la línea ancla `operaciones.gastos.ver`, nunca sustituyéndola (E-047) |
| `src/constants/permisos/permisos.templates.ts` | Los tres permisos en `administrador`. `vendedor` y `almacenero` **sin tocar** |
| `src/constants/routeGuards/routeGuards.json` | Seis filas nuevas, solo las mías. El censo de `routeGuardInventory.test.ts` pasa |

---

## Contradicciones entre el contrato de interfaces y el de diseño — **NO las resuelvo, las reporto**

### 1. Criterio 47 del diseño contra el `ActionSheet` de su propio § 2 — **el más serio**

El § 2 del diseño manda que a **< 600 px** `Perdonar deuda` y `Revertir abono` vivan en un
`ActionSheet`. Ese componente es un `Drawer` de MUI: **se monta en un portal y solo cuando está
abierto**, así que sus filas **nunca** son descendientes de `section.cc-cxc-detalle`.

El **criterio 47** exige, *«en los tres anchos»*, que con los tres permisos
`DETALLE.querySelectorAll('.cc-cxc-perdonar').length > 0` y lo mismo para `.cc-cxc-revertir`. A
320 px eso es **imposible** sin abandonar el `ActionSheet`. Además `ActionSheetItem` no acepta
`className`, así que las filas de la hoja no pueden ni llevar la clase.

**Implementado según el § 2** (ActionSheet a < 600 px, botones con clase a ≥ 600 px). El criterio 47
fallará a 320 px. Hace falta que alguien decida: o el criterio se acota a ≥ 600 px, o las acciones
se sacan del `ActionSheet`.

### 2. Criterio 18 contra criterio 13 del diseño

El **criterio 13** exige cuatro `.MuiOutlinedInput-root` dentro de `PANEL` — es decir, `Select`
**outlined**. El **criterio 18** exige `ownTextEquals(PANEL, "Tramo de antigüedad") === 1`.

Un `OutlinedInput` de MUI con etiqueta pinta el texto **dos veces**: en el `<label>` y dentro del
`<legend><span>` de su `NotchedOutline` (el segundo con `visibility: hidden`, que `textContent`
atraviesa igual). El resultado real es **2**, no 1, y lo mismo con `Deudor`, `Tienda` y
`Estado de la cuenta`. Las dos únicas salidas —quitar la etiqueta, o usar `variant="standard"`—
rompen la otra mitad. Sin resolver.

### 3. `buildFiltroOpciones` está en el § 1 del diseño pero **no** en su § 7

El § 1 dice literalmente «*Ambas cosas las hace `buildFiltroOpciones` (§ 7), que es puro*», pero el
§ 7 enumera **ocho** símbolos y ese no está entre ellos. Lo implementé como función pura en
`src/lib/cuentasPorCobrar/panel.ts`. **Probablemente no esté cubierto por el `dev-tester`**, porque
no aparece en la lista de testabilidad.

### 4. `buildMovimientoRows` no lleva el autor, pero el criterio 52 lo exige

El § 7 (símbolo 20) enumera los campos de `IMovimientoRow` y **`usuarioNombre` no está**. El
criterio 52 —añadido por la misma enmienda— exige que cada `.cc-cxc-movimiento` pinte el nombre del
autor. Como el libro se pinta desde las filas aplanadas, **añadí `usuarioNombre` a `IMovimientoRow`**.
Es aditivo; un test con `toMatchObject` pasa, uno con `toEqual` sobre el conjunto exacto de campos
no. (El del `dev-tester` pasa.)

### 5. `IDeudorInput` no puede transportar `cierrePeriodoAbiertoId`

El § 4 del contrato fija `IDeudorInput` con cinco campos, y `buildDeudorRows` devuelve `IDeudorRow`
cuyo `cuentas[]` es `ICuentaAbierta`, que **exige** `cierrePeriodoAbiertoId` (decisión 13 de la
enmienda). Los dos no encajan: la enmienda añadió el campo al schema y no al input de la función.

Lo resolví con un campo **opcional** `cierrePeriodoAbiertoPorTienda?: Record<string, string>` en
`IDeudorInput`. Con la forma exacta del contrato la función sigue funcionando y devuelve
`cierrePeriodoAbiertoId: null`, así que no rompe a quien la llame según el contrato.

### 6. «El `monto` del perdón es el saldo leído **bajo el bloqueo**» contra la firma de la puerta

El § 5.3 lo dice, y el § 5.2 lo confirma con su caso trabajado *«perdón sobre cuenta saldada → 400
`MONTO_NO_POSITIVO`»*: ese resultado **solo es alcanzable si el `monto` es el saldo leído bajo el
bloqueo** (si viniera de la lectura del paso 4 saldría `SALDO_INSUFICIENTE`). Pero
`applyMovimientoCuentaPorCobrar` recibe el `monto` **ya calculado** y el bloqueo vive **dentro** de
ella: la ruta no podía nombrar el importe.

Lo resolví exportando **`lockCuentaPorCobrar(tx, cuentaId)`** desde `applyMovimiento.ts` —única
declaración del `SELECT … FOR UPDATE` en el proyecto, que la propia puerta usa— y llamándola como
primera operación tras el claim en las rutas de perdón y de reversión. Tomar el lock dos veces en
la misma transacción es un no-op. **§ 3.1 no se tocó ni una línea.**

### 7. § 8.2 «sustituye `toFixed(2)` … en todo el componente» y el `Chip` de equivalencia

El `Chip` de la variante de escritorio usa `toFixed(0)` (compacto, a propósito), no `toFixed(2)`, y
lleva `size="small"`. El § 8.3 enumera de qué elementos se quita el `size="small"` y **el `Chip` no
está en la lista**. Interpreté las dos secciones **literalmente**: cambié los siete `toFixed(2)` de
dinero y dejé el `toFixed(0)` y el `size="small"` del `Chip`. (El `parseFloat(x.toFixed(2))` de
`suggestMonto` tampoco se toca: es aritmética, no formato.)

### 8. «Umbral responsive, una sola vez» contra los criterios 8, 9 y 25

El preámbulo del diseño dice que solo hay un `useMediaQuery(down("sm"))` y que «cualquier otra
bifurcación es CSS responsive». Pero los criterios 8 (7ª columna), 9 (teléfono) y 25 (columna
`Nota`) exigen **montaje condicional** en la frontera de 900 px y **prohíben explícitamente**
resolverlo con `display: none`. Añadí un segundo `useMediaQuery(theme.breakpoints.up("md"))` en las
dos páginas: es la única forma de cumplir esos tres criterios.

---

## Lo que tuve que interpretar porque no estaba cerrado

1. **El texto del campo `error` de los rechazos que no son `SALDO_INSUFICIENTE`.** El § 5.2 fija que
   *todas* las violaciones llevan `saldoPendiente` en el cuerpo y que solo `SALDO_INSUFICIENTE`
   repite la cifra dentro del texto, pero no dice qué dice el texto de las demás. Puse **el propio
   código de la violación** (`REVERSION_DUPLICADA`, `REVERSION_ORIGEN_INALCANZABLE`, …): es
   vocabulario cerrado, no cita ningún dato del usuario (E-031) y es verificable. La pantalla no
   depende de él: pinta su copy a partir del **status**.

2. **Qué pasa si la fila de `CuentaPorCobrar` desaparece entre el paso 4 y el bloqueo.** Ninguna
   violación del vocabulario cubre ese caso. La puerta lanza un `Error` con mensaje fijo → 500
   `errorInterno`.

3. **Cómo baja `estado` al `where` (§ 5.1).** `CON_DEUDA` → `settledAt: null`; `SALDADA` →
   `settledAt: { not: null }`. La etiqueta del filtro es «Estado de la **cuenta**», así que filtra
   cuentas, no deudores. Sin filtro de estado, un deudor totalmente saldado **sí aparece** (con
   `cuentas: []`, `saldo 0` y `estado: "SALDADA"`), que es lo que el criterio 1 del spec y el
   criterio 10 del diseño necesitan del tercer sembrado (`Carla Taller`).

4. **`ultimoAbonoAt` sobre TODAS las cuentas del deudor (§ 13).** Como el `where` del listado puede
   venir acotado por los filtros, la ruta hace una segunda lectura mínima
   (`{ id, clienteId }` de todas las cuentas de esos deudores) antes del `groupBy`. Son **cuatro
   consultas constantes** para toda la respuesta; ninguna es N+1.

5. **Redondeo de `equivalenteBase` en `valueAbonoPagos`.** El contrato solo dice que **la suma** se
   redondea a dos decimales, así que las líneas se persisten con el `convertToBase` sin redondear
   —igual que hace hoy `MultiCurrencyPayment` al construir `pagosDetalle` de una venta— y solo
   `montoBase` se redondea. `sumEquivalenteBase` de la pantalla hace lo mismo.

6. **Las tasas del abono.** El § 5.2 dice «tasas vigentes del negocio → snapshot» sin nombrar la
   función. Reutilicé `resolveSaleTasaSnapshot` de `src/lib/tasaSnapshotResolver.ts`, que ya
   devuelve `{ snapshot, missing }` con `missingRateCodes` aplicado (E-039: no reescribo la
   resolución de tasas).

7. **`buildMovimientoRows` en el detalle: `motivo` y `Nota`.** El diseño pide la columna `Nota` solo
   a ≥ 900 px; a 320 y 768 el `motivo` **no se pinta en ningún sitio**. Lo dejé así, literal.

8. **El `resumen` de 320 px del detalle** (`Saldo … · N cuentas abiertas · 112 días`) usa la
   etiqueta `etiquetaCuentas` en minúsculas para que la frase se lea; el copy literal del § 8 no
   cubre esa línea completa.

---

## Para el `dev-tester` — casos borde que aparecieron implementando

- **`decideMovimientoCuentaPorCobrar` con `origen` no nulo y `tipo` que no es `REVERSION_ABONO`.**
  El § 3.1 lista las guardas 5, 6 y 7 sin prefijo de tipo, pero leen `origen.*`, así que las escribí
  como `origen !== null && …`. Un `ABONO` al que se le pase un `origen` cae en
  `REVERSION_ORIGEN_NO_ES_ABONO`. Conviene fijarlo con un caso.
- **`settledAt` que se QUITA.** Revertir un abono sobre una cuenta saldada devuelve `settledAt:
  null` y la cuenta vuelve a estar viva. Es la fila 12 de la tabla del § 5.2 y la mitad que
  discrimina de «`settledAt` se recomputa, no solo se pone».
- **`netCollectionRows` con una reversión cuyo `revierte.pagosDetalle` es `null`** (no solo cuando
  falta el `revierte` entero): también aporta cero. Es el caso real de una `CONDONACION` mal
  apuntada, y de un abono antiguo sin líneas.
- **`buildDeudorRows` con un deudor de `cuentas: []`.** `saldo 0`, `cuentasAbiertas 0`,
  `antiguedadDias null`, `antiguedadBucket null`, `estado "SALDADA"` — y `ultimoAbonoAt` **sí**
  puede tener fecha. Es exactamente el sembrado `Carla Taller` del criterio 1.
- **`buildDeudorRows` con una cuenta de saldo 0,005** (por debajo de `MIN_OPEN_BALANCE_BASE`): no
  suma, no cuenta y no da antigüedad, pero **sí sigue en `cuentas[]`**.
- **`describeAbono(500, 500)` → `SALDA`, no `EXCEDE`.** Es el límite del criterio 9 visto desde la
  pantalla, y la guarda 8 leída al revés lo rompería sin que nada más lo note.
- **`buildMovimientoRows`: dos cuentas del mismo deudor con abonos del MISMO importe.** El
  `revertido` solo debe mirar dentro de la propia cuenta.
- **`countFiltrosActivos` con `{ clienteId: undefined }`** explícito → 0.
- **`describeFiltros` con un `tiendaId` que no está en `opciones.tiendas`** → se omite, no se pinta
  el uuid.
- **`agingBucketEnum` y `AGING_BUCKET_OPTIONS` derivados**: si alguien añade un quinto tramo a
  `AGING_BUCKETS`, los dos crecen solos. Vale la pena un test que compare longitudes en vez de
  escribir los cuatro a mano.

---

## Errores que me costaron

1. **La escritura de una columna `Json?` nullable de Prisma.** `pagosDetalle: null` **no compila**:
   el tipo generado para un `Json?` es `NullableJsonNullValueInput | InputJsonValue`, y el literal
   `null` no está en él. Hay que escribir `Prisma.JsonNull`. El primer intento fue un doble cast
   (`as Prisma.InputJsonValue as never`) que compilaba y era mentira; lo sustituí por un helper
   `jsonOrNull` con su motivo escrito. Aparece en cuanto un feature escribe por primera vez una
   columna Json opcional, y este es el primero del epic que escribe dos.

2. **El bloqueo y el importe del perdón (contradicción 6 de arriba).** Tardé dos vueltas en ver que
   el caso trabajado *«perdón sobre cuenta saldada → `MONTO_NO_POSITIVO`»* del § 5.2 es
   **inalcanzable** si la ruta pasa el saldo leído en el paso 4: con 500 obsoleto sobre un saldo
   real de 0 sale `SALDO_INSUFICIENTE`. El caso trabajado es correcto y lo que faltaba era una forma
   de leer bajo el bloqueo desde fuera de la puerta. Es la figura inversa de **E-068**: el valor de
   ejemplo era el correcto y lo que no se sostenía era la firma.

3. **El `<legend>` de MUI duplica la etiqueta de todo campo `outlined`** (contradicción 2). No lo
   vi hasta releer el criterio 18 contra el 13; un criterio de conteo por texto sobre un formulario
   de MUI cuenta **el doble** de lo que se ve en pantalla. Es pariente directo de **E-011** y de
   **E-016**, pero con una causa que ninguna de las dos fichas nombra: el marcado oculto que MUI
   añade por su cuenta.

4. **`ActionSheet` es un portal** (contradicción 1). Escribí el detalle entero antes de darme cuenta
   de que los criterios que localizan acciones *dentro de* `DETALLE` no pueden cumplirse a 320 px si
   esas acciones viven en una hoja inferior. Vale la pena anotarlo: **un criterio de DOM que acota
   por sección es incompatible con cualquier control que el diseño mande a un portal** —`Dialog`,
   `Drawer`, `Menu`, `Tooltip`, `Snackbar`—, y el propio documento ya lo sabía para el diálogo de
   cobro (lo dice en su tabla de localizadores) pero no lo aplicó a la hoja de acciones.

---

# Ronda 2 — corrección del rechazo del `qa` (2026-09-10)

Los dos bloqueantes del § 10 de `.agents/archive/F-035-qa.md`, más la discrepancia de localizadores del
criterio 47(b).

## Verificación tras la corrección

| Comando | Exit |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run lint` (corrido **solo**, sin pipe — E-045) | **0** — cero `Error:`, solo los warnings preexistentes del árbol |
| `npx vitest run` | **0** — **193 archivos, 4059 tests, 1 skip, 0 fallos** |

El archivo 193 es `src/__tests__/cuentasPorCobrarServiceDates.test.ts`, la regresión que escribió el
`dev-tester` en paralelo. **No toqué `src/__tests__/**`.**

## Bloqueante 1 — el 500 con ≥ 2 movimientos

**Arreglado en el borde del servicio, que es donde el tipo se perdía.** `axios` no revive fechas:
devuelve exactamente lo que produjo `JSON.parse`, así que todo `Date` de los tipos de este feature
llegaba al navegador como **string**. `buildMovimientoRows` ordena con `fecha.getTime()`, y
`Array.prototype.sort` **no invoca el comparador con menos de dos elementos**: por eso toda cuenta
de un solo movimiento escondía el fallo.

`src/services/cuentasPorCobrarService.ts` pasa ahora **las seis respuestas** por su schema:
`cuentasPorCobrarListResponseSchema`, `cuentaPorCobrarDetalleResponseSchema`,
`deudorDetalleClientSchema` y `movimientoAplicadoResponseSchema` (los tres POST). Es el único punto
donde `z.coerce.date()` corre, y corre una vez para todos los campos a la vez. **No metí ningún
`new Date()` defensivo en el comparador**: eso habría tapado el síntoma y dejado
`fechaVenta`, `settledAt`, `ultimoAbonoAt`, `createdAt` y `at` igual de mal tipados.

### Y aquí hay una mina que el arreglo obvio habría pisado

`deudorDetalleResponseSchema.cuentas[].venta` es `ventaSchema.nullable()`, pero **la respuesta del
propio servidor no satisface ese schema**: `mapVentaToIVenta` (`src/lib/ventaMapper.ts`, F-037)
rellena `usuario.usuario` con `""` y `usuarioSchema` exige `.min(1)`.

**Verificado ejecutando**, no razonado — `ventaSchema.safeParse` de lo que produce el mapper falla
con `too_small` en `["usuario","usuario"]`. Un `deudorDetalleResponseSchema.parse(...)` a secas
habría reventado en **todo deudor que tenga una venta**: un fallo peor que el que se arreglaba.

Por eso añadí en `src/schemas/cuentasPorCobrarPanel.ts` un `deudorDetalleClientSchema`
**derivado con `.extend()`** del schema de respuesta —nunca reescrito (E-014)— en el que `venta`
es el **único** campo que pasa sin validar, con el motivo escrito en su docstring. Ni
`ventaMapper.ts` ni `src/schemas/usuario.ts` son míos (§ 11 del contrato), así que F-035 estrecha
**lo que él parsea** en vez de tocar ninguno de los dos.

> **DEUDA DECLARADA, sin dueño en F-035:** `mapVentaToIVenta` produce un `IVenta` que
> `ventaSchema` rechaza. Es hermana de la deuda 1 que ya declaré (el mapper no copia `creditoBase`
> ni `clienteId`) y **es de F-037**. Mientras siga así, ningún consumidor puede validar una venta
> mapeada contra su propio schema.

### Verificación del arreglo, ejecutada

Parseé el JSON **tal como llega por el cable** (todas las fechas como string, la venta con
`usuario.usuario: ""`) y con **dos** movimientos en una cuenta:

```
fecha is Date        -> true      ultimoAbonoAt Date   -> true
fechaVenta is Date   -> true      at Date              -> true
venta survived       -> true      detalle fecha Date   -> true
rows -> 2, newest first: Maria Cajera                  settledAt Date -> true
ventaFecha is Date   -> true
```

### El mismo patrón en otro sitio — **la respuesta a lo que preguntaste**

**Dentro de F-035: no queda ninguno.** Barrí los consumidores de métodos de `Date`
(`getTime`/`getFullYear`/`getMonth`) y `buildMovimientoRows` era **el único alcanzable desde el
cliente**. Los demás —`daysOutstanding`, `withAging`, `filterByBucket`, `buildDeudorRows`,
`buildCuentasPorCobrarSnapshot`— solo se llaman desde route handlers y desde el motor de cierre,
donde Prisma ya entrega `Date` de verdad. Verificado con `grep` sobre `src/app`, `src/components`
y `src/lib`: cero llamadas desde un `.tsx` de cliente.

Todos los componentes de la pantalla envuelven sus fechas en `new Date(...)` antes de formatear,
y **eso es justamente lo que enmascaraba el borde**: funcionaba con string y con `Date`, así que
solo el `sort` —el único sitio que no lo hacía— destapó el problema. Tras el arreglo esos
`new Date(...)` son redundantes pero correctos; los dejo, porque quitarlos no aporta nada y
volvería a acoplar la pantalla a que el parse exista.

**Fuera de F-035: el patrón es del repositorio entero, y no lo toco.** De ~34 archivos en
`src/services/`, solo **tres** parsean su respuesta con un schema: `tiendaOnlineService.ts`,
`qabNegocioService.ts` y ahora `cuentasPorCobrarService.ts`. Los otros ~31 devuelven
`response.data` crudo bajo un tipo que promete `Date`. Hoy no explota porque casi todas las
pantallas envuelven en `new Date(...)` antes de formatear —igual que las mías—, pero **cualquier
comparador, `sort` o resta de fechas sobre datos de servicio tiene este mismo fallo latente**. Es
material para una ficha de error; no es de F-035 arreglarlo.

## Bloqueante 2 — criterio 21, la colisión de `Limpiar filtros`

Aplicado el copy nuevo del contrato de diseño, que había cambiado **después** de mi entrega:

| Clave | Antes | Ahora |
|---|---|---|
| `sinResultadosDescripcion` | «Prueba con otros filtros, o límpialos para ver la lista completa.» | **«Prueba con otros filtros, o quítalos todos.»** |
| `sinResultadosAccion` | *no existía* | **«Ver la lista completa»** |

`src/app/cuentas-por-cobrar/page.tsx` usa `COPY.sinResultadosAccion` en la acción del `EmptyState`.
A 320 px con un filtro sin resultados quedan **un** `Limpiar filtros` (el suelto de la barra) y
**un** `Ver la lista completa` (el del estado vacío): la colisión E-016 desaparece.

Comprobé además el **resto** del bloque § 8 del diseño contra `CUENTAS_POR_COBRAR_COPY` clave por
clave: esas dos eran las únicas diferencias, más las dos de la hoja de acciones de abajo. Ningún
otro texto había cambiado.

## 3 — los localizadores del criterio 47(b)

El contrato de diseño fija clases y títulos que el código no tenía. Aplicados:

| Contrato | Dónde |
|---|---|
| clase `cc-cxc-acciones-cuenta` + `aria-label="Acciones de la venta"` | el `IconButton` `MoreVert` de `CuentaCard` |
| `title` fijo `Acciones de la venta` | el `ActionSheet` de `CuentaCard` — antes llevaba la fecha de la venta |
| clase `cc-cxc-acciones-movimiento` + `aria-label="Acciones del abono"` | el `IconButton` de la tarjeta de movimiento |
| `title` fijo `Acciones del abono` | el `ActionSheet` de `MovimientosLibro` — antes llevaba la fecha del abono |

Las dos clases nuevas están en `CUENTAS_POR_COBRAR_DOM`, y **ninguna es prefijo de otra**
(`cc-cxc-acciones-cuenta` ≠ prefijo de `cc-cxc-cuenta`, y al revés tampoco). El título fijo es lo
que hace localizable una hoja que vive en un portal y cuyas filas no admiten `className`; con la
fecha colisionaba con las que la propia pantalla pinta (E-008, E-016).

**Y con esto se cae la contradicción 1 que reporté en la ronda 1:** el `ui-designer` corrigió el
**criterio 47**, no el diseño — las dos acciones se quedan en la hoja, y el criterio ya no pide
encontrarlas dentro de la `<section>`, cosa imposible con un `Drawer`.

## Archivos tocados en esta ronda

| Archivo | Qué cambió |
|---|---|
| `src/schemas/cuentasPorCobrarPanel.ts` | `deudorDetalleClientSchema` (derivado, `venta` sin validar) + el tipo `IDeudorDetalleClient` |
| `src/services/cuentasPorCobrarService.ts` | Las seis respuestas parseadas con su schema, y el porqué en el docstring del módulo |
| `src/constants/cuentasPorCobrar.ts` | `sinResultadosDescripcion` corregida; `sinResultadosAccion`, `hojaAccionesCuenta`, `hojaAccionesAbono`; `accionesCuenta` y `accionesMovimiento` en el DOM |
| `src/app/cuentas-por-cobrar/page.tsx` | La acción del `EmptyState` pasa a `sinResultadosAccion` |
| `src/app/cuentas-por-cobrar/components/CuentaCard.tsx` | Clase, `aria-label` y `title` fijo de la hoja |
| `src/app/cuentas-por-cobrar/components/MovimientosLibro.tsx` | Clase, `aria-label` y `title` fijo de la hoja |

## Errores que me costaron, ronda 2

1. **El arreglo obvio del bloqueante 1 era el fallo peor.** `deudorDetalleResponseSchema.parse(...)`
   es lo que pide el sentido común y lo que sugiere el propio informe del `qa`, y **revienta en
   todo deudor con una venta**. Solo se ve ejecutándolo: los dos schemas son de features distintas
   y ninguno de los dos documentos dice que el mapper de F-037 no satisface el schema que F-035
   declara para su propia respuesta. Es **E-068 al revés**: no un valor de ejemplo que contradice
   la regla, sino **dos módulos correctos por separado cuya composición no parsea**, y que nadie
   compone hasta que alguien valida en el borde.

2. **El `sort` que no se ejecuta.** Que `Array.prototype.sort` no llame al comparador con 0 o 1
   elementos convierte un error de tipo en un fallo **dependiente de la cardinalidad de los datos**:
   verde en toda la primera pasada de `qa`, en todos los fixtures unitarios (que construyen `Date`
   de verdad, no JSON) y en cualquier siembra mínima. Un tipo `Date` que en runtime es `string`
   solo se nota donde alguien llama un método, y en esta pantalla ese sitio era **uno**.

---

# Ronda 3 — el 400 que la pantalla se tragaba (§ 12.3 del `qa`)

## Verificación

| Comando | Exit |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run lint` (corrido **solo**, sin pipe — E-045) | **0** — cero `Error:`, **57 warnings, todos preexistentes y ninguno de mis archivos** |
| `npx vitest run` | **0** — 193 archivos, 4059 tests, 1 skip, 0 fallos |

## Dónde estaba el fallo de verdad

**NO en el interceptor, NO en el servicio: en mi página.** Es un bug de F-035, no de media
aplicación.

### Lo primero, descartar el interceptor — comprobado, no supuesto

`src/lib/axiosClient.ts` leído entero. Su manejador de errores hace exactamente tres cosas:
reintenta `ECONNABORTED`/`ERR_NETWORK`, dispara `signOut()` en un **401** (E-007), y sustituye el
cuerpo de un **403** por un `Error` genérico de permisos (E-009). Un **400 cae en el
`return Promise.reject(error)` final, intacto**: `error.response.status` y
`error.response.data.saldoPendiente` llegan al `catch` del diálogo tal cual. El servicio tampoco
puede tragárselo: su `.parse()` solo corre en la rama de éxito, porque en un 400 axios rechaza
antes.

Y el `catch` del diálogo **sí** llamaba a `setErrorSaldo(saldoReal)`. El estado se ponía. Lo que
pasaba es que se **destruía** inmediatamente después.

### La causa raíz, y la huella que la delata

`src/app/cuentas-por-cobrar/[clienteId]/page.tsx` tenía un `return` temprano:

```tsx
if (loading) { return <PageContainer><LoadingState/></PageContainer>; }   // línea 214
...
<AbonoDialog ... onSaldoDesactualizado={cargar} />                        // línea 329
```

Los tres diálogos se renderizan **por debajo** de ese `return`. `cargar()` empieza con
`setLoading(true)`, así que `onSaldoDesactualizado` —que el propio `catch` del 400 invoca para
refrescar la tarjeta de detrás— hacía que el componente devolviera la rama de carga: React
**desmontaba** todo el subárbol, y con él cada `useState` y cada `useRef` del diálogo. Al terminar
la carga el diálogo **se montaba de nuevo, en blanco**, y su efecto de precarga volvía a correr.

En React 18 `setErrorSaldo(...)` y el `setLoading(true)` de `cargar()` se agrupan en el mismo
render, así que el `Alert` **no llegaba a pintarse ni un fotograma**: por eso el `qa` contó cero
`.cc-cxc-error-saldo` en las tres repeticiones, no «a veces».

**La huella que descarta cualquier otra explicación:** el `qa` observó que el campo volvía a
**300** — el saldo **original de cuando el diálogo se abrió**, no el real (120) ni lo tecleado
(180). Ese 300 existe en un solo sitio del programa: el snapshot `cuentaACobrar` capturado al
abrir, que solo se lee en el efecto de precarga. Ni el interceptor, ni el servicio, ni ningún
`catch` pueden producir ese número. **Solo un remontaje que vuelve a ejecutar la precarga.** Los
cuatro síntomas —error invisible, campo repuesto a 300, «Este cobro salda la deuda.» en verde
(`describeAbono(300, 300)` → `SALDA`), botón rehabilitado— salen de esa única causa.

**Y había un quinto síntoma que nadie vio, peor que los cuatro:** el remontaje regeneraba también
`idempotencyKeyRef`. El reintento del cajero dejaba de ser el **replay** que `src/lib/idempotency.ts`
garantiza y pasaba a ser **un cobro nuevo de verdad**. El camino del criterio 8 estaba roto justo
en el escenario donde más falta hace.

## Los otros dos diálogos: sí, uno lo tenía igual

- **`RevertirAbonoDialog`: mismo bug, misma vía.** Su `onYaRevertido` también es `cargar`, así que
  un **409 `REVERSION_DUPLICADA`** ponía «Ese abono ya se revirtió.» y el desmontaje se lo comía:
  el cajero veía el diálogo listo para reintentar una reversión que ya estaba hecha.
- **`PerdonarDeudaDialog`: expuesto, aunque no se disparaba solo.** No llama a `cargar` en su
  `catch`, así que no se auto-destruía; pero cualquier otro refresco con él abierto —el botón de
  recarga de la cabecera, o el cierre de otro diálogo— le borraba el error y el motivo escrito.

Los tres quedan arreglados por la misma corrección.

## Qué cambié

| Archivo | Cambio |
|---|---|
| `src/app/cuentas-por-cobrar/[clienteId]/page.tsx` | **(1)** `if (loading && !detalle)`: el esqueleto es solo para la **primera** carga; con datos en pantalla el refresco ocurre **en su sitio** y no desmonta nada. **(2)** La rama de error a pantalla completa pasa a `if (!detalle)`, y un refresco que falla ya **no** tira los datos que había: avisa con un toast en vez de sustituir la pantalla. **(3)** Los tres diálogos se direccionan **por id** y la fila se **deriva** de `detalle`, así que un `cargar()` les entrega el saldo real en vez del congelado al abrir |
| `AbonoDialog.tsx`, `PerdonarDeudaDialog.tsx`, `RevertirAbonoDialog.tsx` | Guarda de **sesión** (`sesionRef`) en el efecto de reinicio: corre **una vez por apertura** y no vuelve a correr aunque el objeto cambie de identidad al refrescar. Sin ella, derivar la fila habría reintroducido el mismo bug por otra puerta |

### El resultado, ejecutado sobre la carrera exacta del `qa` (180 tecleado, saldo real 120)

```
before (stale 300)   -> PARCIAL                         (lo que se veía antes de que llegara el 400)
after  (real 120)    -> EXCEDE  exceso 60
result line          -> El cobro supera el saldo en 60,00 CUP
alert                -> El saldo real de esta cuenta es 120,00 CUP. Ajusta el monto y vuelve a intentarlo.
confirm disabled     -> true
NOT the silent green -> true
```

El criterio 38 se cumple —el diálogo abierto, **un** `.cc-cxc-error-saldo` con la cifra real
formateada— y la exigencia 2 también: el campo **conserva el 180 tecleado**, el botón queda
**deshabilitado** (el monto ahora excede el saldo verdadero) y la clave de idempotencia
**sobrevive**, así que un reintento sigue siendo un replay.

## Deuda ajena que este arreglo destapó, y que NO toco

**El manejo de 403 de los tres diálogos es código muerto, por E-009.** El interceptor sustituye
**cualquier** 403 por un `new Error(...)` sin `response`, así que la rama `status === 403` no se
alcanza nunca a través de `axiosClient` y el usuario ve `errorGenerico` en lugar de
`errorSinPermiso`. Es cosmético aquí (la pantalla ya oculta los botones sin permiso, así que un
403 es casi inalcanzable) y arreglarlo de verdad es tocar `src/lib/axiosClient.ts`, que no es mío
y afecta a toda la aplicación. **No lo parcheo con un `match` sobre el texto del mensaje**: sería
frágil y escondería el problema real. Dejo la rama escrita —es correcta contra un interceptor
correcto— y lo reporto.

## Errores que me costaron, ronda 3

1. **Un `return` temprano por `loading` es un `unmount`, y eso borra estado que alguien acaba de
   escribir.** El patrón «`if (loading) return <Skeleton/>`» está por todo el repositorio y es
   inofensivo mientras la pantalla no tenga nada abierto encima. En cuanto hay un diálogo con
   estado —un monto tecleado, un error del servidor, una clave de idempotencia— **cualquier
   recarga en segundo plano lo destruye en silencio**. Lo peligroso es que el síntoma no se parece
   a la causa: parece que el error «no se muestra», y en realidad el error se mostró y el
   componente entero dejó de existir en el mismo render. **Candidato claro a ficha de error.**

2. **Derivar la fila en vez de guardarla arregla un bug y arma otro.** Al pasar de un snapshot a
   una fila derivada de `detalle`, el objeto cambia de identidad en cada recarga y el efecto de
   reinicio —cuyas dependencias incluían `cuenta`— habría vuelto a limpiar el error y el monto:
   el mismo bug entrando por la puerta de al lado. La guarda de sesión por id es lo que separa
   «se abrió el diálogo» de «llegaron datos nuevos», que es la distinción que el efecto necesitaba
   desde el principio y no tenía.

3. **Con `curl` este bug no existe.** La API respondía perfecto en las tres rondas anteriores y por
   eso sobrevivió: el fallo vivía enteramente en el ciclo de vida de React, y solo aparece
   ejercitando el diálogo real. Es el mismo tipo de agujero que el `sort` de la ronda 2 —un fallo
   que necesita una condición que la verificación cómoda nunca produce—, y las dos veces lo
   encontró el `qa` **usando la pantalla**, no la API.
