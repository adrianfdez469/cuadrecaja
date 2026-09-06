# ADR 0054: Cuántas páginas se piden por corrida, y el presupuesto de tiempo del pull dentro del cron

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-010

## Contexto

El spec deja esta decisión explícitamente al arquitecto: el contrato de QAB pagina el pull con
`limit=100` y un `nextCursor`, y hay dos extremos.

- **Una página por corrida.** Un negocio con 400 pedidos atrasados tarda cuatro corridas —ocho
  minutos— en ponerse al día.
- **Páginas hasta que `nextCursor` sea `null`.** Se pone al día en una sola corrida, pero consume un
  presupuesto de tiempo que no es suyo.

El presupuesto es real y ya está repartido. Lo que hay puesto hoy:

- `maxDuration = 60` en `src/app/api/crons/sync-tienda/route.ts`; el cron corre cada dos minutos.
- `QAB_SYNC_RUN_DEADLINE_MS = 35_000`: el techo de corrida que `slugLearn` y `availability` ya usan
  para recortar su propio presupuesto de fase.
- `QAB_ORDER_POLL_TX_TIMEOUT_MS = 30_000`: el tiempo máximo que puede vivir la transacción
  interactiva de **un** negocio, la que sostiene el advisory lock y una conexión del pool dedicado de
  dos (ADR 0015).
- `QAB_HTTP_TIMEOUT_MS = 10_000`: lo que puede tardar **una** llamada.

Y un hueco que F-002 dejó abierto sin consecuencias y que este feature convierte en un riesgo: **el
bucle del pull no tiene ningún presupuesto de tiempo.** Recorre todos los negocios elegibles en
serie, uno detrás de otro. Mientras `pullQabOrders` no hacía ninguna llamada de red eso era gratis.
Con la ranura rellena, N negocios lentos en serie se comen los 60 segundos de la función.

Y el modo de falla si la transacción de un negocio revienta su `timeout` no es un reintento: Prisma
**revierte la transacción entera**, así que se pierde todo lo escrito para ese negocio, el cursor no
avanza, y la corrida siguiente vuelve a intentar exactamente lo mismo. Estancamiento, no retraso.

Peor todavía: ese rollback sale como una **excepción** (`P2028`) por fuera de
`withQabOrderPollLock`, donde `pullQabOrders` ya no puede hacer nada. Sin un `try/catch` por
iteración se propagaría fuera de `runQabSyncTiendaCron()` y dejaría sin procesar a todos los negocios
que vinieran detrás en el `for` — una violación del criterio 12 por la vía de la base de datos en vez
de la del HTTP. Hoy no ocurre porque `pullQabOrders` es un stub que nunca lanza; **F-010 es la
primera versión que puede dispararlo.**

## Decisión

**Varias páginas por corrida, con dos topes que se recortan mutuamente: un tope duro de páginas y un
presupuesto de tiempo que se comprueba antes de cada página. Un presupuesto de fase para el bucle del
cron, que hasta hoy no tenía ninguno. Y un `try/catch` por iteración, para que el rollback de un
negocio no se lleve por delante a los que van detrás.**

```ts
QAB_ORDER_PULL_PAGE_SIZE = 100;            // el del contrato
QAB_ORDER_PULL_MAX_PAGES_PER_RUN = 5;      // 500 pedidos por negocio y corrida
QAB_ORDER_PULL_BUDGET_MS = 15_000;         // por negocio, DENTRO de su transacción
QAB_ORDER_POLL_PHASE_DEADLINE_MS = 20_000; // el bucle entero, recortado por la corrida
```

**La guarda es «¿cabe una página entera en lo que queda?», no «¿queda tiempo?»:**

```ts
Date.now() + QAB_HTTP_TIMEOUT_MS <= deadlineAt
```

Se evalúa **antes de cada página** con el `deadlineAt` del negocio, y **antes de cada negocio** con
el `deadlineAt` de la fase. Comprobar que queda *algo* de tiempo en vez de que quepa *una página*
autoriza precisamente la llamada que va a rebasar el límite.

Cómo se comporta con esos números:

| Escenario | Páginas que salen | Cuándo termina el negocio |
|---|---|---|
| Respuestas rápidas (~200 ms) | 5 — manda el tope duro | ~2 s |
| Respuestas lentas (10 s, el timeout) | 1 — manda el presupuesto: en `t=10 000`, `10 000 + 10 000 > 15 000` | ≤10 s |
| Respuesta intermedia (~4 s) | 2 — en `t=8 000`, `8 000 + 10 000 > 15 000` | ~8 s |

En todos los casos el negocio deja **al menos 15 s** de los 30 s de
`QAB_ORDER_POLL_TX_TIMEOUT_MS` para escribir sus filas y confirmar. El presupuesto no se calcula
para que quepa: se calcula para que **sobre**, porque rebasarlo no cuesta un retraso, cuesta perder
la corrida entera de ese negocio.

`deadlineAt` de la fase se fija como las otras dos fases del cron:

```ts
Math.min(Date.now() + QAB_ORDER_POLL_PHASE_DEADLINE_MS, startedAtMs + QAB_SYNC_RUN_DEADLINE_MS)
```

Un negocio al que no le llega el turno se reporta como `skipped_deadline`, con su lock **sin
intentar**: no se toma un advisory lock que no se va a usar.

**Convergencia:** 500 pedidos por negocio y corrida, y el cron corre cada dos minutos. Un negocio con
2000 pedidos atrasados converge en cuatro corridas —ocho minutos—, sin poner en riesgo ninguna
corrida. Y **cada corrida escribe lo suyo**: el cursor avanza al final de cada página procesada, así
que un negocio que se queda a medias no pierde lo que ya escribió.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Una sola página por corrida | Simple y seguro, pero deja 100 pedidos por cada dos minutos como techo absoluto, también cuando la respuesta tarda 200 ms y sobran 29 segundos de transacción. Un negocio que abre su tienda online con backlog tarda horas en ponerse al día por una restricción que no existe |
| Páginas hasta `nextCursor: null` | Sin un tope, un negocio con 10 000 pedidos monopoliza la corrida, revienta `QAB_ORDER_POLL_TX_TIMEOUT_MS`, **pierde todo lo escrito** por el rollback y deja al resto de negocios sin turno. Y con un tope de tiempo pero sin tope de páginas, un negocio grande escribe miles de filas en una sola transacción interactiva sobre un pool de dos conexiones |
| Solo el tope de páginas, sin presupuesto de tiempo | Cinco páginas a 10 s cada una son 50 s de HTTP dentro de una transacción con `timeout` de 30 s: el rollback está garantizado justo en el caso que el tope pretendía cubrir |
| Solo el presupuesto de tiempo, sin tope de páginas | Con respuestas rápidas el presupuesto autoriza decenas de páginas y miles de filas en una transacción. El tope de páginas es lo que acota la **escritura**, no el tiempo |
| Bajar `QAB_ORDER_PULL_PAGE_SIZE` por debajo de 100 | El spec fija `limit=100` en su alcance, y bajarlo multiplica los viajes sin reducir el trabajo. El tamaño de la respuesta se resuelve con su propio tope computado (ADR 0055), no encogiendo la página |
| Mover el pull delante de `availability` para que no lo starven las fases previas | Reabre el ADR 0049, que puso `availability` delante precisamente porque el pull toma un advisory lock por negocio y sostiene transacciones largas. Fuera del alcance de F-010 |

## Consecuencias

**A favor:**

- Un negocio con backlog converge en minutos, no en horas, sin arriesgar ninguna corrida.
- Ningún negocio puede monopolizar el bucle: el presupuesto de fase se comprueba antes de cada uno.
- Una excepción de base de datos deja de ser capaz de terminar la corrida: se cuenta en `failed`, se
  reporta con `lock: "unknown"` y el bucle sigue.
- El bucle del pull deja de ser la única fase del cron sin presupuesto de tiempo.
- Los dos topes tienen sentidos distintos y por eso son dos: el de páginas acota la **escritura**, el
  de tiempo acota la **transacción**. Cada uno cubre el caso que el otro no ve.

**En contra / coste asumido:**

- **El pull es la última fase y puede quedarse sin turno.** Si el drenaje, `slugLearn` y
  `availability` consumen los 35 s de `QAB_SYNC_RUN_DEADLINE_MS`, la fase de pull arranca con
  presupuesto cero y **todos** los negocios salen `skipped_deadline`. No se pierde nada —el pull es
  idempotente y guiado por cursor—, pero los pedidos se retrasan hasta la corrida siguiente. Es
  aceptado a sabiendas: el remedio real sería reordenar las fases, y eso reabre el ADR 0049. Queda
  anotado como seguimiento, no resuelto aquí.
- Un negocio muy atrasado sigue tardando varias corridas. Es deliberado: la convergencia entre
  corridas sucesivas no es un requisito del spec.
- Los cuatro números son estimaciones razonadas sobre los `timeout` ya fijados, **no medidas contra
  el QAB real**. El presupuesto de 15 s deja el doble de margen del que la aritmética del peor caso
  exige, precisamente porque no están medidos.

**Impacto en seguridad y escalabilidad:**

- El advisory lock se sostiene como mucho `QAB_ORDER_PULL_BUDGET_MS` más las escrituras, muy por
  debajo de su `timeout`, así que una conexión del pool dedicado de dos no queda retenida.
- Un negocio que no llega a su turno no toma su advisory lock: no hay locks tomados y soltados en
  vacío.
- El trabajo por corrida está acotado por arriba en las dos dimensiones que crecen sin límite
  —pedidos pendientes y negocios elegibles—, así que el coste de una corrida no depende del histórico.
