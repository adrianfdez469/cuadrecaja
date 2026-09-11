# ADR 0112: El rastro de sincronización visible se decide por `wasOffline`, y `syncAttempts` solo cuenta desde 2

**Estado:** aceptado — **su umbral está enmendado por el [ADR 0113](0113-la-fila-declara-si-su-contador-cuenta-fallos-y-el-umbral-sale-de-esa-marca.md)** (2026-09-11)
**Fecha:** 2026-09-10
**Feature:** F-032

> **El segundo hemistiquio del título —«y `syncAttempts` solo cuenta desde 2»— ya no es cierto sin
> condición.** Desde F-034 el umbral depende de si la fila declara qué cuenta su contador: `1`
> cuando lo declara, `2` cuando no. Lo que sigue vigente sin cambios es la señal principal
> (`wasOffline`) y la prohibición de derivar nada de la distancia entre `frontendCreatedAt` y
> `createdAt`. Ver la **enmienda del 2026-09-11**, al final de este documento.

## Contexto

El ADR 0108 acepta el reloj del dispositivo como eje del cierre apoyándose, entre otras cosas, en
que la manipulación *«queda como rastro, no prevención: `Venta.usuarioId` dice quién la hizo, y
`wasOffline`, `syncAttempts` y la distancia entre `frontendCreatedAt` y `createdAt` quedan guardados
y permiten auditarlo después»*. Tras F-031 ese rastro **no era visible en ninguna pantalla**:
`wasOffline` y `syncAttempts` están declarados en `IVenta` (`src/schemas/venta.ts:49-50`) y el
mapeo del `GET` de ventas del período **nunca los copiaba** — la forma exacta de **E-013**.

F-032 los trae al navegador (criterio 4) y pide que el detalle de una venta sincronizada tarde lo
muestre (criterio 5) **y que una venta ordinaria no muestre nada de eso** (criterio 6, tan
vinculante como el 5). Hacía falta decidir **qué condición** enciende esa sección.

Dos hechos acotaban la decisión antes de empezar:

- **La distancia entre `frontendCreatedAt` y `createdAt` no discrimina.**
  `.agents/designs/F-031.md` ya lo verificó: el POS manda su `Date.now()` y Postgres sella
  `createdAt` al insertar, así que **toda** venta tiene una diferencia no nula, también las hechas
  en línea. Discriminar por ahí exigiría un umbral, que el ADR 0108 ya descartó por otra vía.
- El spec de F-032 proponía **`wasOffline` con `syncAttempts`** como la señal que sí discrimina. La
  primera parte es correcta; la segunda no lo era tal como se leía.

### El hecho que se verificó al escribir este contrato: `syncAttempts` se cuenta de dos maneras

Leyendo los productores de esa columna en este repositorio:

- **Camino en línea del POS** — `src/app/pos/page.tsx:1118`: la llamada a `createSell` pasa el
  **literal `1`**. Una venta normal, que sincroniza a la primera y nunca estuvo sin conexión, se
  guarda con `syncAttempts = 1`.
- **Cola de sincronización** — `src/app/pos/page.tsx:664` — **y reenvío manual** —
  `src/app/pos/components/SalesDrawer.tsx:222` y `:262`: los tres mandan el contador **tal como
  estaba antes del intento**, porque `markSyncing` lo incrementa en el store
  (`src/store/salesStore.ts:201`) y el objeto que se envía se leyó antes de esa llamada — el propio
  código lo comenta así en `pos/page.tsx`. Una venta encolada que sincroniza a la primera se guarda
  con `syncAttempts = 0`.

Es decir: **`0` y `1` los produce, cada uno por un camino distinto, una venta que no necesitó
ningún reintento.** El mismo nombre y la misma columna con dos convenciones de conteo — un pariente
directo de **E-014**.

La consecuencia práctica: un predicado `syncAttempts > 0` **dispararía en casi toda venta en
línea**, que es exactamente lo que el criterio 6 prohíbe, y **pasaría igualmente el criterio 6** si
el `qa` siembra su venta ordinaria con `syncAttempts: 0` como el spec indica. Un defecto invisible
en la verificación y visible en producción: **E-008**.

## Decisión

**La señal es `wasOffline`, y `syncAttempts` solo a partir de 2.** Una función pura,
`hasSyncTrace(sale)` en `src/lib/venta/saleSyncTrace.ts`:

```
wasOffline === true  ||  (syncAttempts ?? 0) >= SALE_SYNC_TRACE_MIN_ATTEMPTS
```

con `SALE_SYNC_TRACE_MIN_ATTEMPTS = 2` en `src/constants/venta.ts`.

- **`wasOffline`** es la señal principal: el POS web de este repositorio la escribe como
  `!isOnline` en el momento de crear la venta (`src/app/pos/page.tsx:973`), así que **ninguna venta
  en línea de ese POS la produce**. La acotación importa: el APK sincroniza por
  `src/app/api/app/venta/[tiendaId]/[periodoId]/route.ts:406`, que guarda `wasOffline || false` del
  cuerpo, y **su código no está en este repositorio** — lo que ese cliente decida marcar es suyo, y
  esta decisión no lo puede afirmar.
- **`>= 2`** cubre el caso que `wasOffline` deja fuera —una venta **creada en línea** que acabó en
  la cola de reintentos, porque `wasOffline` se sella al crearla y no se revisa después— sin
  alcanzar a ninguna primera tentativa: ni el `1` del camino feliz ni el `0` de la cola llegan a 2.
- **Los dos campos ausentes se leen como «no marcada»**, nunca como «desconocida»: siguen siendo
  opcionales en `IVenta` porque F-032 corrige **un solo** productor.

**La condición no se deriva en ningún caso de la distancia entre los dos instantes**, bajo ningún
umbral.

### Enmienda del 2026-09-10: dónde se expresa la regla (el paso 4b la movió, no la cambió)

`.agents/designs/F-032.md` añadió al mismo módulo un **selector de razones**,
`saleSyncTraceReasons(sale)`, que devuelve cuáles de las dos se cumplen —**las dos a la vez cuando
así es**— como valores de un vocabulario cerrado (`SALE_SYNC_TRACE_REASONS`, en
`src/constants/venta.ts`). Existe porque, sin él, el diálogo tendría que deducir la rama de
reintentos **por eliminación** a partir de la composición interna del gate: E-014, y además pierde
el caso de las dos razones simultáneas.

Con eso, **la fórmula de arriba pasa a vivir dentro de `saleSyncTraceReasons`, y `hasSyncTrace` se
define como «el selector devolvió algo»**. Se anota aquí, con fecha y en el propio ADR, para que el
docstring de la firma y el criterio de este documento no acaben afirmando cosas distintas
(**E-030**):

- **La decisión no cambia**: la señal sigue siendo `wasOffline`, y `syncAttempts` sigue contando
  solo desde `SALE_SYNC_TRACE_MIN_ATTEMPTS = 2`. La tabla de verdad de `hasSyncTrace` es la misma.
- **Lo que cambia es el punto en que se expresa**, y a mejor: la regla queda escrita **una sola
  vez**. La invariante que el contrato de diseño pide —el selector devuelve algo si y solo si el
  gate es `true`— deja de ser algo que haya que vigilar y pasa a ser estructural, porque no hay dos
  condiciones que puedan discrepar.
- **`syncAttempts` no se pinta**, y esto sí es consecuencia directa de este ADR: la decisión de
  diseño cita las dos convenciones de conteo como su motivo. La condición previa para que la cifra
  pueda mostrarse alguna vez es unificarlas — la deuda que este documento declara más abajo.

Lo que el detalle muestra como *«a qué hora la recibió el servidor»* es **`Venta.createdAt` tal
cual**: es lo que esa columna es, y derivar o parafrasear cualquier otra cosa sería E-039.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `wasOffline \|\| syncAttempts > 0` | El camino en línea del POS guarda el literal `1` (`src/app/pos/page.tsx:1118`), así que dispara en la mayoría de las filas: rompe el criterio 6 **en producción** mientras lo pasa con la siembra que el spec indica (`syncAttempts: 0`). Es E-008 |
| `wasOffline` a secas | Deja fuera la venta **creada con conexión** que terminó en la cola de reintentos: `wasOffline` se sella al crearla (`!isOnline`) y no se revisa después. El criterio 6 define «ordinaria» como *«no offline, **sin reintentos**»*, así que los reintentos forman parte de la definición |
| Derivar de la distancia entre `frontendCreatedAt` y `createdAt`, con o sin umbral | Verificado en `.agents/designs/F-031.md`: es no nula en **toda** venta, también en línea. El ADR 0108 ya descartó los umbrales de desfase por convertir el criterio en función del fixture |
| Unificar antes las dos convenciones de conteo de `syncAttempts` en el POS | Cambia lo que se **escribe**, no lo que hay escrito: haría falta además un backfill de las filas ya guardadas, y F-032 excluye explícitamente corregir ninguna fila existente. Queda declarado como deuda, abajo |
| ~~Una columna nueva `syncedLate` calculada al insertar~~ · ~~`>= 1` en vez de `>= 2`~~ · ~~unificar las convenciones~~ | **Las tres las revisó el ADR 0113 por su nombre y dos de ellas se adoptaron en otra forma.** Ver la enmienda del 2026-09-11 |
| Umbral `>= 1` en vez de `>= 2` | Es el mismo defecto que `> 0` con otro nombre: `1` es lo que guarda una venta en línea de primera tentativa |
| Deducirlo de la presencia de `syncId` | Toda venta del POS lo lleva; no discrimina nada |
| Una columna nueva `syncedLate` calculada al insertar | Migración más backfill, fuera del alcance; y congelaría en la escritura una regla que hoy se deriva de datos que ya están |

## Consecuencias

**A favor:**

- El criterio 5 y el criterio 6 se cumplen **por el mismo mecanismo**, no por dos reglas que haya
  que mantener alineadas: una sola función decide, y el diálogo no renderiza nada cuando devuelve
  `false`.
- La condición es **lógica pura**, probable sin base de datos, y el caso que separa el código
  correcto del que pasa por casualidad —`wasOffline: false, syncAttempts: 1`— es un caso de test
  explícito.
- El rastro que el ADR 0108 daba por auditable **pasa a serlo de verdad** en la única pantalla que
  lo necesitaba, y **solo** ahí: la inmensa mayoría de las filas no gana ni una palabra.
- Los dos campos que llegan al cliente no requieren consulta, columna, migración ni cambio del
  `include`: la fila ya viajaba entera.

**En contra / coste asumido:**

- **El umbral es una convención, no una ley, y lo que la columna contiene depende del cliente que
  la escriba.** El APK sincroniza por
  `src/app/api/app/venta/[tiendaId]/[periodoId]/route.ts:407`, que guarda `syncAttempts || 0` del
  cuerpo, y **su código no está en este repositorio**. El umbral está elegido para que ninguna
  primera tentativa **del POS de este repo** lo alcance —ni contando desde 0 ni contando desde 1—,
  y eso es todo lo que se puede afirmar: si algún cliente contara desde 2, su primera tentativa
  encendería la sección.
- **Las dos convenciones de conteo de `syncAttempts` no se corrigen aquí**, ni en el código ni en
  los datos. Queda como deuda declarada: el número guardado no significa lo mismo según qué camino
  lo escribiera, y por eso el contrato de F-032 advierte que **no se pinte como «N intentos»** sin
  decidirlo a la vista de este ADR.
- **Una venta creada en línea que acabó en la cola y sincronizó al segundo intento se guarda con
  `1`** —el contador previo al intento que sí funcionó— y por tanto **no** enciende la sección.
  El `>= 2` cubre las que fallaron dos veces o más, no todas las que reintentaron alguna vez.
- **Mostrar el rastro no impide la manipulación del reloj que el ADR 0108 describe.** La deja
  visible **después del hecho**, y solo para las ventas que pasaron por `wasOffline` o por
  reintentos. Una venta hecha **en línea** con el reloj del cajero desviado nunca marca
  `wasOffline`, así que **no deja ningún rastro visible nuevo en `/ventas`**: ni la fila ni el
  detalle la señalan. F-032 hace cierto lo que el ADR 0108 ya afirmaba; no cierra la puerta que ese
  mismo ADR documenta como abierta, y no añade ninguna validación de entrada.
- **Ninguna fila ya guardada se reclasifica ni se re-etiqueta.**

**Impacto en seguridad y escalabilidad:**

- **Aislamiento:** los dos campos son columnas de la **misma fila `Venta`** que el `GET` ya devolvía
  entera, bajo el mismo `withTenantScope("venta", …, negocioId)` con `negocioId` tomado de la
  sesión. No se añade consulta, ruta, parámetro de entrada ni identificador procedente de la
  petición. Por eso F-032 no invoca a `security-guardian`, y queda escrito para que conste que se
  decidió.
- **Exposición:** `wasOffline` y `syncAttempts` describen **cómo llegó** una venta que el usuario ya
  puede ver entera, con su importe, sus productos y su vendedor. No revelan nada de otro negocio ni
  de otra tienda.
- **Escalabilidad:** ninguna consulta nueva, ningún campo calculado en la base, ningún índice. El
  `include` y el `select` no cambian: `findMany` ya devolvía todas las columnas escalares de
  `Venta`.
- **Reversión barata:** sin migración ni columna. Revertir el código devuelve el `GET` a omitir los
  dos campos y el diálogo a no tener sección.


---

## Enmienda del 2026-09-11: el umbral deja de ser una constante (F-034, ADR 0113)

Se anota aquí, en el propio documento y con fecha, para que nadie lea el criterio de arriba como
vigente ni descubra la contradicción leyendo el código (**E-030**).

**Lo que este ADR declaró como deuda está pagado.** Su lista de *En contra* decía: *«las dos
convenciones de conteo de `syncAttempts` no se corrigen aquí, ni en el código ni en los datos»*.
F-034 corrige el código: el camino en línea del POS web deja de mandar el literal `1` y manda, como
la cola y como el APK, el contador tal como estaba antes del intento. **Los datos ya guardados
siguen sin corregirse, y no se pueden corregir**: una fila antigua con `1` es indistinguible para
siempre entre «en línea sin reintentos» y «de cola con uno».

**Lo que cambia de este documento:**

- **El `>= 2` deja de valer para todo.** El umbral pasa a ser una función pura de la fila:
  `1` si la fila declara que su contador cuenta fallos (`Venta.syncAttemptsAreFailures === true`),
  `2` si no lo declara. `SALE_SYNC_TRACE_MIN_ATTEMPTS = 2` **conserva su nombre y su valor**, pero
  su docstring cambia: ya no justifica el `2` con «dos clientes cuentan distinto», sino con «las
  filas sin declaración son ambiguas».
- **La justificación del `2` de este ADR queda como justificación de la rama sin declaración.**
  No se borra: describe correctamente por qué una fila que no declara nada no puede bajar de `2`.
- **Tres de sus alternativas descartadas las revisó el ADR 0113 por su nombre**: «una columna nueva
  calculada al insertar» (se adopta, sin backfill y guardando **procedencia**, no la regla
  calculada), «umbral `>= 1`» (se adopta **solo** para las filas declaradas) y «unificar antes las
  dos convenciones» (se hace, y es F-034).
- **Sobre el APK, este ADR afirmaba menos de lo que ahora se afirma.** Decía: *«lo que ese cliente
  decida marcar es suyo, y esta decisión no lo puede afirmar»*. El criterio 3 de F-034, congelado,
  **sí lo afirma** —con `sync_service.dart:497`, `:548` y `:958` como fuente— y sobre esa premisa
  descansa el sello de `/api/app`. Es una premisa heredada, y su excepción está escrita en el 0113.

**Lo que NO cambia, y por eso este ADR no queda reemplazado:**

- **La señal principal sigue siendo `wasOffline`.**
- **Nada se deriva de la distancia entre `frontendCreatedAt` y `createdAt`**, bajo ningún umbral.
- **`hasSyncTrace` sigue definiéndose como «el selector devolvió algo»**, y la regla sigue escrita
  una sola vez dentro de `saleSyncTraceReasons` — la enmienda del 2026-09-10, más arriba, sigue en
  pie tal cual.
- **Ninguna fila ya guardada se reclasifica ni se re-etiqueta.** Una fila antigua con `1` se sigue
  clasificando exactamente como hoy: sin rastro.

**Lo que cambia de comportamiento, y es deliberado:** este ADR decía en su lista de *En contra* que
*«una venta creada en línea que acabó en la cola y sincronizó al segundo intento se guarda con `1`
y por tanto no enciende la sección»*. A partir de F-034, una venta **nueva** en esa situación **sí**
la enciende. Bajo la convención alineada `1` es un fallo, y seguir exigiendo `2` sería sub-marcar un
rastro real.

**Y una consecuencia sobre una pantalla que este ADR no nombraba:** «Mis Ventas» del POS
(`SalesDrawer.tsx`) **compone** `(N intentos)` con su propio gate `sale.syncAttempts > 0`, dentro de
un campo `status` que **nadie lee** — verificado el 2026-09-11: de los cuatro campos que devuelve
`formatSaleInfo`, la pantalla consume solo `date` y `products`. La cifra nunca llegó al DOM, así que
la decisión de este ADR de **no pintarla** se venía cumpliendo ahí **por accidente**. F-034 borra el
bloque, por el criterio 8 —la comparación está viva aunque su texto no se lea— y con eso pasa a
cumplirse **por construcción** en todas las pantallas de este repositorio. Su condición para
reponerla algún día ya no es «unificar las convenciones», sino «solo sobre las filas que llevan la
marca».
