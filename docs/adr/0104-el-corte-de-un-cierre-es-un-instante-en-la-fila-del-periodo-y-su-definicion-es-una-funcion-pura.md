# ADR 0104: El corte de un cierre es un instante en la fila del período, y su definición es una función pura

**Estado:** aceptado
**Fecha:** 2026-09-08
**Feature:** F-029

## Contexto

Cerrar la caja cierra hoy con **todas** las ventas del período abierto. Cuando se olvida cerrar,
dos jornadas quedan mezcladas en el mismo cierre y no hay forma de separarlas. F-029 pide poder
elegir, antes de cerrar, qué ventas entran; las demás pasan al período siguiente.

El diseño con el que se abrió el feature era una **lista de ids de venta**: el usuario marcaba
casillas y la lista viajaba en el cuerpo del cierre. Arrastraba cuatro problemas que no se
resolvían por separado:

- Un día diferido son cientos de UUID en cada petición, y en un `GET` de previsualización ni
  siquiera caben en el query string.
- Una venta registrada **después** de armar la selección y antes de confirmar no estaba en la
  lista, así que hacía falta una regla explícita y discutible para decidir dónde caía.
- Una venta hecha sin conexión que sincroniza después de armar la selección tampoco estaba en la
  lista que el usuario vio, así que quedaba fuera del cierre sin que nadie lo decidiera. **No es un
  punto a favor del corte** —corregido el 2026-09-09, ver la sección final—: el corte tampoco la
  mete. Se conserva porque es un defecto real del diseño de lista, no una ventaja comparativa.
- La pantalla, las dos rutas de gastos porcentuales y el cierre tenían que ponerse de acuerdo
  sobre la misma lista, cada una por su cuenta.

Restricciones vigentes: `loadCierreComputationInput` (`src/lib/cierre/loadCierreInput.ts`) declara
en su propio docstring que es *the only place that decides which sales, expenses and movements
belong to a period*, y carga las ventas **por la relación** `cierre.ventas`, no por rango de
fechas. Los movimientos de caja (`COMPRA`, `MERMA`, `DEVOLUCION_VENTA`) sí se cargan por rango.
Y el criterio 12 exige que la decisión de qué entra sea lógica **pura**, testeada sin base de
datos ni red.

## Decisión

**"Qué ventas entran" deja de ser una lista y pasa a ser un instante:** una columna nueva
`CierrePeriodo.salesCutoffAt DateTime?`, y una venta entra en el cierre cuando
`createdAt <= salesCutoffAt`. `NULL` significa "sin corte" y es, byte por byte, el comportamiento
anterior.

La **definición** de esa regla es una única función pura, `isSaleIncludedInCutoff`, en
`src/lib/cierre/salesCutoff.ts`. Las otras dos formas que el sistema necesita —la partición en
memoria que usa el cálculo del cierre, y el filtro SQL del `updateMany` que reasigna lo
diferido— viven en **ese mismo módulo** y se derivan de ella. Ninguna se reescribe fuera.

El corte se aplica **si y solo si el período está abierto**. Una vez escrita `fechaFin`, la
relación `Venta.cierrePeriodoId` es la verdad y todo lector ignora la columna, que queda como
constancia de cómo se cerró el período.

Y la cota superior de la ventana de movimientos tiene una sola precedencia, escrita en el loader:
`cierre.fechaFin ?? corte ?? fechaFinOverride ?? null`. El corte gana al `fechaFinOverride` a
propósito: es lo que hace que la pantalla y el cierre vean exactamente los mismos movimientos.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Lista de ids de venta en el cuerpo del cierre (diseño original) | Cientos de UUID por petición; obliga a una regla aparte para la venta que llega tarde; y cada consumidor tiene que acordar la misma lista por su cuenta |
| Híbrido: casillas libres y `fechaFin = max(createdAt de las seleccionadas)` | Una venta deseleccionada **anterior** al corte viviría en un período cuya `fechaInicio` es posterior a su propio `createdAt` — justo la disociación entre relación y fechas que el corte existe para eliminar—, y devuelve el doble conteo de movimientos |
| Una tabla de marcas (una fila por venta excluida) | Un índice y una tabla nuevos para expresar algo que un solo `timestamp` expresa mejor; y sigue admitiendo la exclusión no contigua que se descartó |
| El corte solo en memoria de la sesión de cierre | No sobrevive a un refresco, no lo ven los demás cajeros de la tienda, y las dos rutas de gastos porcentuales no tendrían de dónde leerlo |
| Filtrar las ventas en SQL dentro del loader (`where` sobre la relación) | El resumen de lo diferido —cuántas ventas y por qué importe, criterio 6— exigiría una segunda consulta y una segunda valoración; partiendo en memoria sale del mismo motor, y la función pura del criterio 12 se ejercita en producción en vez de quedar decorativa |
| Aplicar el corte también con el período ya cerrado | Una venta que un admin reasignara a un período cerrado, con `createdAt` posterior al corte con el que se cerró, quedaría excluida en silencio del recálculo |

## Consecuencias

**A favor:**

- Una venta registrada mientras se cuenta el efectivo va al período nuevo **sin que nadie lo
  programe**: la decisión del humano sobre la pregunta abierta 1 deja de ser una regla y pasa a ser
  una propiedad del modelo. Con una excepción que conviene enunciar en vez de dejar el absoluto
  (E-017): una venta cuyo `INSERT` confirme **después** del `updateMany` del cierre puede quedarse
  con el `cierrePeriodoId` del período recién cerrado, porque el `POST` de venta resuelve a qué
  período pertenece fuera de todo bloqueo y solo toma el advisory lock cuando hay vuelto en
  efectivo. Es la ventana del propio cierre, existe hoy igual, y la repara el mecanismo de *drift*
  del ADR 0036.
- El período nuevo empieza exactamente donde termina el cerrado, así que los movimientos de caja
  intermedios no se cuentan dos veces ni se quedan fuera de los dos.
- Por ninguna petición viaja un identificador de venta: la superficie nueva es un `timestamp`.
- La pantalla, las dos rutas de gastos y el cierre **leen la misma columna**.

**En contra / coste asumido:**

- **Solo corte contiguo.** No se puede dejar fuera una venta suelta del medio conservando las de
  antes y las de después. Si una venta puntual está mal, se corrige o se elimina: es otro flujo.
- **Una venta *offline* entra por la hora en que se sincronizó, no por la hora en que se hizo.**
  `Venta.createdAt` no la fija el cliente: la columna se creó con `DEFAULT CURRENT_TIMESTAMP`
  (`prisma/migrations/20250324160538_init/migration.sql`) y ninguna de las dos rutas de creación de
  venta —`/api/venta/[tiendaId]/[cierreId]` y `/api/app/venta/[tiendaId]/[periodoId]`— la escribe.
  La hora que manda el dispositivo se guarda aparte, en `frontendCreatedAt`, y el corte no la lee
  en ningún sitio: `partitionSalesByCutoff` y `deferredSalesCreatedAtFilter` comparan contra
  `createdAt`, y el diálogo pinta esa misma columna. Consecuencia concreta: una venta hecha sin
  conexión ayer a las 22:00 que sincroniza hoy a las 07:00 lleva `createdAt` de las 07:00, así que
  un corte al final de ayer **la difiere** — una venta que sí fue de ayer se va al período
  siguiente, que es justo la mezcla que F-029 existe para evitar. La disyuntiva se detalla en la
  sección final y **queda abierta**: este ADR no la resuelve.
- **La frontera es inclusiva por abajo.** Una venta sellada en el mismo milisegundo que el corte
  queda dentro. Se declara en vez de esconderse.
- El chip de un día fija el corte al **final de ese día**, salvo el día en curso: su final todavía
  no ha ocurrido y el corte se rechazaría por posterior al instante actual (criterio 9), así que el
  chip de hoy fija el corte **ahora**. Es la misma cosa mientras hoy siga corriendo, pero es una
  excepción real y por eso está escrita, no deducida. El acotado simétrico por abajo cubre el caso
  contrario: un `createdAt` anterior a `fechaInicio` no puede producir un corte inválido. Ese
  acotado es una guarda del invariante, **no el remedio de un caso *offline***: como el servidor
  sella `createdAt` al recibir la venta (sección final), una venta sincronizada tarde no llega con
  un `createdAt` anterior al período abierto en el que se sella.
- **"Todo el período" quita el corte, no fija uno.** Decisión del humano del 2026-09-08, sobre la
  pregunta abierta 3 del contrato de diseño: guardar `mode: "now"` habría dejado el banner puesto
  anunciando que se difieren cero ventas, un estado que el operador lee como que algo pasa cuando no
  pasa nada. "Todo el período" y "Quitar corte" son la misma elección — `NULL` — y la pantalla queda
  exactamente como si nunca se hubiera preparado nada. `mode: "now"` conserva su llamador: el chip
  del día en curso.
- **El período cerrado y el nuevo comparten el instante del corte** como borde de la ventana de
  movimientos (`lte` en uno, `gte` en el otro). Un `MovimientoStock` cuya `fecha` coincida al
  milisegundo con el corte contaría en los dos. Es el reflejo del hueco que ya existe hoy entre la
  `fechaFin` de un período y la `fechaInicio` del siguiente, y se acepta por la misma razón: el
  criterio 11 pide que el período nuevo empiece **exactamente** en el corte, y desplazarlo un
  milisegundo lo incumpliría literalmente.
- Con corte puesto, la tasa que `computeCierreTotals` aplica a todo lo que no es una venta pasa a
  ser la vigente **en el corte**, no la del instante de pulsar cerrar. Es coherente —el período
  termina ahí— pero es un cambio de valor observable.
- `salesCutoffAt` sigue escrita en los períodos ya cerrados y nadie la lee. Es constancia, no
  estado; el riesgo de que alguien la use como señal (E-013) se contiene con el comentario de la
  columna y con la regla "solo con el período abierto".

**Impacto en seguridad y escalabilidad:**

- **Aislamiento:** el corte se lee siempre de la fila del período, ya localizada con el `where` del
  tenant; nunca llega desde la petición un identificador de venta que haya que validar uno por uno.
- **Escalabilidad:** no añade consultas. El loader sigue haciendo una lectura por la relación
  `ventas` y parte en memoria; el resumen de lo diferido sale de esa misma partición. El volumen es
  el de **un período abierto**, que es lo que ya se recorre hoy.
- **Reversión barata:** la columna es nullable y su valor por defecto es el comportamiento
  anterior. Revertir el código deja períodos con un corte guardado que nadie lee.

---

## Corrección posterior (2026-09-09)

**Este ADR afirmaba lo contrario de lo que hace el código, y la afirmación se había propagado.**
La frase corregida decía, en la lista "A favor":

> Una venta *offline* de ayer que sincroniza hoy, con el corte ya puesto, entra en el cierre
> correcto **por su propio `createdAt`**.

Es falsa, y también lo eran sus dos ecos —el bullet del "Contexto" y la fila de la tabla de
alternativas— que la usaban para dar por perdido ese punto al diseño de lista de ids.

**Lo que el código hace,** verificado el 2026-09-09:

| Pieza | Qué se comprobó |
|---|---|
| `prisma/schema.prisma` | `Venta.createdAt DateTime @default(now())`; `frontendCreatedAt DateTime?` es **otra** columna |
| `prisma/migrations/20250324160538_init/migration.sql` | `"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` — la sella Postgres |
| `src/app/api/venta/[tiendaId]/[cierreId]/route.ts` | El `venta.create` **no** escribe `createdAt`; el `createdAt` del cuerpo va a `frontendCreatedAt` |
| `src/app/api/app/venta/[tiendaId]/[periodoId]/route.ts` | Igual |
| `src/lib/cierre/salesCutoff.ts`, `src/lib/cierre/loadCierreInput.ts`, las dos rutas de gastos porcentuales, el `close` | Ninguna lee `frontendCreatedAt`: el corte compara **siempre** contra `createdAt` |

De modo que **el corte ordena las ventas por la hora en que llegaron al servidor**. En el caso que
F-029 existe para resolver —se olvidó cerrar y el período abierto mezcla dos jornadas— eso significa
que una venta hecha sin conexión ayer a las 22:00 y sincronizada hoy a las 07:00 tiene `createdAt`
de las 07:00: el chip de "ayer" **no la incluye** y el cierre de ayer la difiere.

**Por qué no se escribe aquí la promesa contraria.** La corrección obvia —leer
`frontendCreatedAt ?? createdAt` en el corte— **no está decidida y tiene un coste real**, así que
esto queda como disyuntiva abierta y no como solución pendiente:

- **A favor de cambiarlo:** el resto del sistema ya trata `frontendCreatedAt` como "cuándo ocurrió
  de verdad" —`src/lib/reports/sales-stream.ts` (`soldAt`), `src/lib/gastos.ts`, el ticket
  (`src/features/printing/lib/ventaToSale.ts`), `SalesDrawer`, y `resolveSaleTasaSnapshot`, que
  elige con esa hora la tasa histórica de la venta—. Hoy la misma venta se lee a las 22:00 en "Mis
  Ventas" y a las 07:00 en el diálogo del corte.
- **En contra:** `frontendCreatedAt` **viene del dispositivo**. El corte usa hora de servidor a
  propósito, para que un reloj adelantado no cuele un instante inválido; es la misma razón por la
  que el chip del día en curso resuelve a `mode: "now"` en vez de fijar el final de hoy (criterio
  9). Aceptar la hora del dispositivo como eje del corte reabre esa puerta.

Decidir entre las dos es un cambio de comportamiento observable y de superficie de confianza:
**material para un feature propio, no para una edición de este ADR.**

**Segunda corrección — la advertencia sobre `/api/resumen-dia` ya no aplica.** Quedó anotada en
`.agents/features.json` como consecuencia que "conviene escribir en el ADR" (nunca llegó a
escribirse aquí, y por eso este ADR no la traía): que `/api/resumen-dia` acota los
`MovimientoStock` por las fechas del período, de modo que los movimientos de stock de una venta
diferida se seguirían viendo bajo el día del período cerrado. **Era cierta con el diseño anterior,
en el que el período cerraba en "ahora"; con el corte no lo es**, y por eso se retira de donde sí
estaba escrita (la sección «Contexto necesario» de `.agents/specs/F-029.md` y su § 15, y las `notes` del feature):

- `src/app/api/cierre/[tiendaId]/[cierreId]/close/route.ts` escribe `fechaFin = cutoffAt ?? new Date()`.
  Con corte puesto, **`fechaFin` es el corte**.
- `src/app/api/resumen-dia/[tiendaId]/route.ts` y su gemela `/api/app/` acotan con
  `fecha: { gte: cierre.fechaInicio, lte: cierre.fechaFin ?? new Date() }`.
- `MovimientoStock.fecha` es `@default(now())` y `CreateMoviento` no la escribe; el movimiento de
  `VENTA` se inserta en la **misma transacción** que la venta.

Luego el movimiento de una venta diferida es posterior al corte, cae **fuera** de la ventana del
período cerrado y **dentro** de la del nuevo: fechas y relación coinciden, que es exactamente lo que
el corte consigue. El único borde que queda es el que este ADR ya declara aparte —un movimiento cuya
`fecha` coincida al milisegundo con el corte cuenta en los dos períodos—, y no se toca.

La otra mitad de aquella consecuencia **sigue vigente y se conserva**: el stream de reportes acota
por las fechas del período al que la venta pertenece (`src/lib/reports/sales-stream.ts` filtra por
`cierrePeriodo.fechaInicio`/`fechaFin`), así que una venta diferida se reporta bajo el período
nuevo.

> Registro: E-017 — un absoluto escrito en un ADR que el código no sostiene. Es la tercera
> aparición, y la primera mitad de esta corrección estaba **un bullet por debajo** de otra que cita
> E-017 por su nombre.
