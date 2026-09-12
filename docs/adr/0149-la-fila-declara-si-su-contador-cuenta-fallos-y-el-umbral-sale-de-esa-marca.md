# ADR 0149: La fila declara si su contador cuenta fallos, y el umbral del rastro sale de esa marca

**Estado:** aceptado
**Fecha:** 2026-09-11
**Feature:** F-050
**Relación:** enmienda el ADR 0148 — **solo su umbral**. La señal principal de aquel documento
(`wasOffline`) y su prohibición de derivar nada de la distancia entre `frontendCreatedAt` y
`createdAt` siguen vigentes sin cambios.

## Contexto

El ADR 0148 fijó que el rastro de sincronización visible se decide por `wasOffline`, y que
`syncAttempts` solo cuenta **desde 2**. El `2` no era una elección de redondeo: era la consecuencia
de un defecto que ese mismo ADR descubrió y **declaró como deuda sin pagar** —«las dos convenciones
de conteo de `syncAttempts` no se corrigen aquí, ni en el código ni en los datos»—. Con dos clientes
escribiendo la misma columna con dos significados, `2` era el valor más bajo que ninguna primera
tentativa podía alcanzar.

F-050 paga esa deuda. Y al pagarla, invalida el umbral.

### El diagnóstico cambió al verificarlo: no son dos convenciones, es una línea

Esto es lo primero que hay que saber, porque el ADR 0148 lo describe de otra manera. Leyendo los
tres productores:

- **La cola del POS web** (`src/app/pos/page.tsx:664`), **el reenvío manual**
  (`SalesDrawer.tsx:222` y `:262`) y **el APK** (`sync_service.dart:497`, `:548`, `:958`, en el
  repositorio hermano `cuadre_caja_app`) **ya coinciden**: cuentan intentos **fallidos**, así que
  una venta que entra a la primera guarda `0`.
- **El único fuera de sitio es el camino en línea del POS web** (`src/app/pos/page.tsx:1118`), que
  pasa el **literal `1`** para toda venta que sincroniza a la primera.

Y un dato que fija cuál de las dos es la convención correcta, no por gusto sino porque ya hay
producto encima: **el APK lleva tiempo enseñando la cifra** (`ventas_list_screen.dart:68-71`,
*«Intentos de sincronización: N»* bajo `syncAttempts > 0`) y bajo su convención **es correcta**.

Así que alinear significa: que el camino en línea mande, como los otros tres, *el contador tal como
estaba antes del intento*.

### El nudo: arreglar la línea no arregla la historia

Una fila **antigua** con `syncAttempts: 1` puede ser una venta en línea sin ningún reintento —la
mayoría abrumadora— o una de cola con un reintento. **Ese dato se perdió** y no hay forma de
recuperarlo.

Eso rompe el umbral del ADR 0148 por los dos lados a la vez, sobre la misma entrada
`{wasOffline: false, syncAttempts: 1}`:

- **`>= 2` sub-marca la venta nueva.** Con la convención alineada, una venta con exactamente un
  reintento real se guarda con `1` y no llegaría al umbral: tiene rastro y no se vería. Es el
  criterio 4 de F-050.
- **`>= 1` sobre-marca las filas antiguas.** El `1` legado no es distinguible de un reintento real,
  así que casi toda venta en línea anterior al cambio empezaría a mostrar un rastro que no tuvo.
  Es el criterio 6.

Las restricciones que acotaban la salida:

- **Los nueve criterios están congelados** y tres de ellos —4, 5 y 6— exigen que la **misma pareja
  `(wasOffline, syncAttempts)`** dé resultados distintos según la población. Ninguno de los dos
  campos lo dice.
- **El criterio 9 exige que la decisión sea lógica pura**, probable sin base de datos.
- **El criterio 8 exige una sola definición de la regla**, la misma función que ya usan el filtro
  de `/ventas` y la sección del detalle.
- **El criterio 6 prohíbe expresamente migrar o reclasificar** las filas existentes.
- **El APK no se toca**: vive en otro repositorio y ya hace lo correcto.

## Decisión

**La fila declara si su propio contador cuenta fallos, y el umbral se lee de esa declaración.**

Una columna nueva y **anulable**, `Venta.syncAttemptsAreFailures Boolean?`, sin `DEFAULT` y sin
backfill. Se escribe **al insertar** y **solo hacia adelante**. `NULL` significa *«nadie lo dejó
dicho»* — nunca *«contaba intentos iniciados»*.

El umbral deja de ser una constante y pasa a ser una **función pura de la fila**, en el mismo
módulo de siempre (`src/lib/venta/saleSyncTrace.ts`):

```
saleSyncTraceMinAttempts(sale) =
  sale.syncAttemptsAreFailures === true
    ? SALE_SYNC_TRACE_MIN_FAILED_ATTEMPTS   // 1
    : SALE_SYNC_TRACE_MIN_ATTEMPTS          // 2
```

y `saleSyncTraceReasons` conserva **su única comparación**, ahora contra ese umbral:

```
(sale.syncAttempts ?? 0) >= saleSyncTraceMinAttempts(sale)
```

`hasSyncTrace` sigue siendo *«el selector devolvió algo»*, tal como fijó la enmienda del ADR 0148.
**La regla sigue escrita una sola vez**: lo que se bifurca es de dónde sale el umbral, no cuántas
reglas hay. Esa distinción es todo el argumento contra E-014, y es estructural: hay un `>=` en el
árbol de producción y está en ese archivo.

### Quién escribe la marca, y por qué cada ruta decide distinto

- **`/api/venta` (POS web): la declara el cliente.** `createSell` (`src/services/sellService.ts`)
  añade el campo al cuerpo, y el `POST` guarda `true` **solo** si el cuerpo lo dice `=== true`; en
  cualquier otro caso deja `NULL`. Así, un bundle anterior que siga vivo en una pestaña abierta
  **no** marca sus filas, y sus ventas quedan clasificadas como antiguas —la dirección segura.
- **`/api/app` (APK): la sella el servidor**, sin condición. El APK no se toca y su convención la
  afirma el criterio 3 de F-050 como hecho verificado. Sellarlo aquí es lo que permite que **el
  contrato externo `APP_API_CONTRACT.md` no cambie en absoluto**.

### Qué significa entonces «una venta nueva»

**Nueva = la fila lleva la marca. Antigua = no la lleva.** No es una fecha de corte, ni un rango de
`id`, ni nada deducido de la forma del dato (**E-049**): es un hecho que se escribe al insertar, y
por eso solo puede existir hacia adelante. El `qa` puede sembrar las dos poblaciones poniendo o no
poniendo una columna, que es justo lo que los criterios 4, 5 y 6 daban por hecho que existía.

### La asimetría, dicha en voz alta

Para la fila antigua ambigua la decisión **elige sub-marcar**: `1` sin declaración se lee como *sin
rastro*. Se pierde el rastro de la venta de cola rara antes que inventarle un reintento a la venta
en línea común. No es neutral y no puede serlo: el dato no está.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Mantener `>= 2` para todo** | Es lo que hay hoy, y a partir del arreglo **sub-marca** una venta nueva con un reintento real, que sí tiene rastro y sí se puede probar. Contradice el criterio 4, congelado |
| **Bajar a `>= 1` para todo** | **Sobre-marca** casi toda venta en línea anterior al cambio, porque el `1` legado no es distinguible. Es el defecto que el ADR 0148 rechazó como `> 0` con otro nombre, y ahora además contradice el criterio 6 |
| **Un instante de corte constante en el código** | Una fecha horneada es distinta en cada entorno y en cada despliegue, y quien la teclee acierta o falla en silencio. Es clasificar por la forma del dato en vez de pedir el dato (E-049) |
| **El instante de corte guardado en la base al migrar** | Clasificar por `createdAt < corte` sí sería exacto respecto a «qué código insertó la fila», pero obliga a **leer la base para decidir** y a **enhebrar ese valor** hasta una página de cliente (`/ventas`) y hasta el diálogo de detalle. La regla dejaría de ser pura sin parámetros, por el mismo efecto que una columna que ya viaja con la fila |
| **Backfill de las filas antiguas a `0`** | Es inventar el dato que se perdió, y el criterio 6 lo prohíbe literalmente |
| **Una columna que guarde el hecho derivado («esta venta reintentó») en vez de la procedencia** | Duplica en la escritura algo que `syncAttempts` ya dice bajo la convención alineada, y una copia puede contradecir a su fuente (E-039). La procedencia, en cambio, es **irreducible**: no se deriva de nada y no puede discrepar de nada |
| **Que también el APK declare la marca en el cuerpo** | Cierra el hueco del punto 3 de *En contra*, pero exige tocar el contrato externo, que F-050 excluye. Queda anotado como la salida el día que ese contrato se revise |
| **Sellar `true` en el servidor también para `/api/venta`** | Un bundle viejo vivo en una pestaña abierta seguiría mandando el literal `1` y el servidor lo marcaría como alineado: sobre-marcaría exactamente las filas comunes que esta decisión protege |
| **`Boolean NOT NULL @default(false)`** | Le atribuye a cada fila antigua una afirmación —«su contador no contaba fallos»— que nadie hizo, y el criterio 6 pide que ninguna migración las toque. `NULL` dice lo único cierto: que no se sabe |
| **No mostrar nada del rastro hasta que se extingan las filas antiguas** | No se extinguen: no hay purga de ventas históricas, y esperar es esperar para siempre |

### Tres filas del ADR 0148 que esta decisión revisa por su nombre

El ADR 0148 descartó estas tres opciones. Ninguna de las tres se contradice en silencio:

1. **«Una columna nueva calculada al insertar»** — rechazada por *«migración más backfill, fuera
   del alcance»*. Aquí **no hay backfill**: la columna es anulable y la migración es una sola
   sentencia sin `UPDATE` y sin `DEFAULT`. Y el alcance es otro: F-048 excluía tocar filas
   existentes, F-050 tiene el criterio 6 exigiendo que se respeten. Además lo que se guarda no es
   la regla calculada —eso era lo que aquel ADR temía «congelar en la escritura»—, sino **la
   procedencia**, que es un hecho del momento de escribir y no una regla que pueda quedarse vieja.
2. **«Umbral `>= 1` en vez de `>= 2`»** — rechazada porque *«`1` es lo que guarda una venta en
   línea de primera tentativa»*. Sigue siendo verdad **para las filas sin marca**, y por eso ahí el
   umbral sigue siendo `2`. El `1` se aplica **solo** donde esa frase ya no se cumple.
3. **«Unificar antes las dos convenciones de conteo»** — descartada entonces como deuda. **Esta
   decisión la paga**, y por eso existe F-050.

Y un punto donde este ADR **afirma más** que el 0112, deliberadamente: aquel decía del APK que
*«lo que ese cliente decida marcar es suyo, y esta decisión no lo puede afirmar»*. El criterio 3 de
F-050, congelado y aprobado por el humano, **sí lo afirma** —con `sync_service.dart:497`, `:548` y
`:958` como fuente— y sobre esa afirmación descansa el sello de `/api/app`. Es una premisa
heredada, no una verificación hecha en este repositorio, y su excepción está escrita abajo.

## Consecuencias

**A favor:**

- **El número guardado pasa a significar lo mismo lo escriba quien lo escriba**: intentos que
  fallaron. Es el criterio 3, y es lo que permite que la cifra vuelva a ser interpretable algún día.
- **Una venta nueva con un solo reintento deja de ser invisible.** El ADR 0148 documentaba ese
  agujero en su propia lista de *En contra*; aquí se cierra para las filas que sí tienen rastro.
- **Ninguna fila ya guardada se reclasifica, se migra ni se toca.** La migración es metadato.
- **La regla sigue teniendo una sola definición y una sola comparación**, en el mismo archivo puro
  de siempre, con los mismos dos consumidores (`/ventas` y la sección del detalle) llamándola sin
  reescribir nada.
- **La decisión del umbral es un símbolo propio, puro y exportado**, así que el criterio 9 se puede
  probar de verdad y el caso que separa el código correcto del que aprueba por casualidad —la
  pareja `(false, 1, true)` contra `(false, 1, null)`— es un test explícito.
- **El contrato externo de `/api/app` no cambia ni una línea**, y el APK tampoco.

**En contra / coste asumido:**

- **Una fila antigua con `1` sigue siendo indistinguible, y lo será siempre.** Este documento la
  clasifica como *sin rastro*: no es una recuperación, es una elección entre dos errores. Ningún
  documento posterior debe llamarla «caso raro» ni «transitorio» (**E-017**).
- **«Toda fila posterior al despliegue lleva la marca» es falso.** Una pestaña del POS abierta
  antes del despliegue sigue sirviendo el bundle anterior hasta que se recargue y guarda sus ventas
  sin marca. No hay service worker en este repositorio —verificado— así que el hueco se acota a la
  sesión abierta, y cae del lado seguro: se pierde el rastro de un reintento raro, no se inventa uno.
- **El sello incondicional de `/api/app` descansa en código que no está aquí.** Si quedara instalado
  un APK antiguo con la convención vieja, o si otro cliente empezara a usar esa ruta, sus ventas de
  primer intento quedarían **sobre-marcadas**. La salida está escrita en la tabla de alternativas.
- **Ahora hay dos umbrales que mantener coherentes.** Son dos constantes leídas en un solo sitio, lo
  cual acota el riesgo, pero no lo anula: si alguien tocara el `2` creyendo que ya no se usa, las
  filas antiguas cambiarían de clasificación en silencio.
- **La cifra sigue sin mostrarse en el historial web, y una comparación muerta se borra.**
  En «Mis Ventas» del POS (`SalesDrawer.tsx`), `formatSaleInfo` compone `(N intentos)` dentro de un
  campo `status` que **nadie lee**: de los cuatro campos que devuelve, la pantalla consume `date` y
  `products`, y `status` y `total` se tiran. Esa cifra **nunca llegó al DOM**. Lo que sí está vivo
  es su gate, `sale.syncAttempts > 0` (`:465`), una comparación propia fuera de
  `saleSyncTrace.ts` — y eso el criterio 8 de F-050 no lo admite. **Se borra el bloque entero**, y
  el motivo es el criterio 8, no el 7. El efecto sobre el 7 es de refuerzo: esta pantalla lo
  cumplía **por accidente** —bastaba escribir `{saleInfo.status}` en el JSX para romperlo— y pasa a
  cumplirlo **por construcción**. La condición para enseñar la cifra algún día ya no es «unificar
  las convenciones» —eso está pagado— sino restringirla a las filas que llevan la marca.

  > **Corrección del 2026-09-11.** La primera redacción de este punto decía que esa pantalla
  > *«pintaba `(N intentos)`»*. Es falso: confundía el **call site** de `formatSaleInfo` (`:595`,
  > `:797`) con el **consumo de su campo**. Lo halló el `ui-designer` y lo verificó el coordinador;
  > queda corregido en sitio, con la decisión intacta y el motivo reforzado. Es **E-016 en su
  > séptima aparición**, y el chequeo que lo destapa cuesta un comando:
  > `grep -n "<campo>" <archivo>` — si solo sale la línea que lo **compone**, no se pinta.
- **Esto no vuelve fiable el número, solo lo vuelve interpretable.** Sigue siendo lo que un cliente
  dice de sí mismo, sin corroboración del servidor, exactamente igual que antes.
- **Esta decisión no toca nada de lo que el ADR 0108 dejó abierto**: una venta hecha en línea con
  el reloj del cajero desviado sigue sin dejar ningún rastro visible nuevo.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento: no hay superficie nueva.** La columna es un escalar más de la **misma fila
  `Venta`** que el `GET` ya devolvía entera bajo
  `withTenantScope("venta", { cierrePeriodoId, tiendaId }, scope.negocioId)`. Ese `where` no se
  reescribe, el `include` no cambia, y `negocioId` sigue saliendo de la sesión. El `POST` sigue
  entrando por `assertTiendaTenant` antes de leer nada del cuerpo.
- **El único campo nuevo de entrada es un booleano que no participa en ninguna cláusula de
  consulta**: se persiste y nada más. No puede ampliar el alcance de una lectura ni cruzar un
  tenant, y por eso F-050 no invoca a `security-guardian` — decidido, no olvidado.
- **Exposición:** describe **cómo llegó** una venta que quien la ve ya puede ver entera, con su
  importe, sus productos y su vendedor. No revela nada de otro negocio ni de otra tienda.
- **Escalabilidad: ninguna consulta nueva, ningún índice, ningún N+1.** Un booleano anulable no
  cambia ningún plan, y `ADD COLUMN` sin `DEFAULT` no reescribe la tabla.
- **Reversión barata en el código, irreversible en los datos solo en el sentido inofensivo:**
  revertir el código devuelve el umbral a `2` para todas las filas y la sección a su comportamiento
  de hoy. La columna puede quedarse, vacía de sentido, sin molestar a nadie; no hace falta bajarla.
