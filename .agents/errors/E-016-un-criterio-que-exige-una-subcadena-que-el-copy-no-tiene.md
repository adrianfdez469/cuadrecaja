# E-016: Un criterio verificable que exige una subcadena que el copy dictado no contiene

**Área:** ui
**Apariciones:** 9 — F-005 (dos veces en el mismo documento: criterios 43 y 20) · F-020 (criterio 23) · F-011 (dos variantes nuevas) · F-012 (dos más, y una invierte el modo de fallo) · F-023 (la subcadena prohibida **dentro de una palabra del propio copy**; cazada por el `ui-designer` antes de escribirse) · F-036 (la variante **inversa**: el copy correcto en el sitio equivocado, y **nueve criterios** del mismo documento con el mismo defecto). · F-037 (la variante del **conteo**: la subcadena SÍ estaba en el copy, y la pantalla la pinta dos veces; ver la adenda de F-037) · F-047 (dos formas: la granularidad del formateador, y `sync` dentro de `async`) · **F-050 (el call site de la función en vez del consumo del campo)**. Ver las adendas.

## Síntoma

Un criterio de diseño falla en el navegador aunque la implementación escribió **exactamente** el
copy que el contrato dicta. Las dos veces:

```
Criterio 43: el textContent del diálogo NO debe contener «Agrupar»
   … pero el copy que el mismo documento dicta para ese diálogo usa «Agrupar locales»

Criterio 20: el textContent debe contener «no es una reserva»
   … pero el copy que el mismo documento dicta dice «Es un pronóstico, no una reserva»
```

`"no una reserva"` no contiene `"no es una reserva"`. Dos frases que significan lo mismo y una
subcadena que no coincide.

## Causa raíz

Un contrato de diseño tiene dos partes escritas en momentos distintos: **el copy**, redactado como
prosa, y **el criterio verificable**, redactado después como un `textContent.includes(...)`. Nadie
comprueba que la segunda esté contenida, carácter por carácter, en la primera — se comprueba que
signifiquen lo mismo, que es otra cosa.

El coste no es el fallo en sí, es a quién señala: el implementador escribió lo que estaba dictado,
así que el rechazo apunta a código correcto. La primera vez (criterio 43) el implementador cambió
el copy para satisfacer al criterio, y **esa fue la decisión equivocada**: el criterio era el que
estaba mal, porque el spec exigía advertir que *agrupar* es irreversible, y no se puede advertir de
lo que está prohibido nombrar.

## Solución

Las dos veces, **cede el criterio, no el copy** —el copy es la decisión de producto y el criterio
es solo su comprobación—, y lo corrige el `ui-designer` en su documento; el implementador no
improvisa el arreglo.

Y una vez detectado el patrón, un repaso mecánico en vez de a ojo: extraer **todos** los code spans
de la sección de criterios y buscar cada uno como subcadena literal en el copy que el documento
dicta. En F-005 eso confirmó que no había un tercero escondido, y dejó localizadas las cuatro
señales legítimas: una plantilla `{N}`, una negrita de markdown que el `textContent` concatena
igual, una cita explicativa, y las cadenas que están prohibidas por definición.

## Cómo evitarlo

**Un criterio que exige una subcadena literal se escribe copiando y pegando del copy, nunca
tecleándolo de nuevo.** Reescribirlo de memoria es donde se cuela el «es».

Al cerrar un contrato de diseño, pasar el repaso mecánico: cada subcadena exigida tiene que
aparecer, exacta, en el copy dictado — salvo las prohibidas, que por definición no aparecen, y las
que llevan plantilla o formato, que hay que normalizar antes de comparar.

Y para quien reciba el rechazo: **si el copy que escribiste es literalmente el que el contrato
dicta, no lo cambies para contentar al criterio.** Devuélvelo al `ui-designer`: una de las dos
partes de su documento está mal y solo él sabe cuál.

---

## Reaparición en F-020 — el criterio 23, y lo que la cazó

Mismo patrón exacto, en un criterio **heredado**: el 23 de F-005, diferido a F-020, exigía del banner
de campos vacíos la subcadena

```
se va a borrar de tu tienda online
```

«en la ayuda del campo **y en la cabecera de recuento**». La ayuda del campo la contiene; el banner
dice `se **van** a borrar`, porque habla de N campos. Un plural contra un singular.

**Lo cazó el repaso mecánico que esta ficha recomienda**, aplicado por el `ui-designer` sobre su
propio documento antes de entregarlo: extraer los code spans de la sección de criterios y buscarlos
como subcadena literal en el copy dictado. Es la primera vez que este error se detecta antes de
costar un rechazo, y confirma que el repaso funciona.

**La corrección fue partir el criterio en dos** (uno para el campo, otro para el banner), no tocar
ninguno de los dos copys. La regla del final de esta ficha se sostuvo: el copy era el dictado y el
equivocado era el criterio.

Dos cosas que esta aparición añade:

- **El plural es un generador de este error.** Un copy que cuenta cosas tiene dos formas, y un
  criterio escrito de memoria elige una. Al exigir una subcadena de una frase con recuento, hay que
  comprobar contra **todas** sus ramas — y si el copy no tiene la rama que hace falta, eso es un
  hallazgo, no un detalle: en F-020 fue así como se descubrió que el banner **no tenía forma
  singular** y decía «1 datos están vacíos».
- **Un criterio heredado de otro feature es el más expuesto**, porque se cita por número y se
  ejecuta sin releer el copy al que apunta. Ver
  [E-018](E-018-la-redaccion-congelada-de-un-criterio-diferido.md).

---

## Adenda F-011 — dos variantes que la ficha no recogía

Las dos las cazó el propio `ui-designer` repasando su documento **antes** de entregarlo, así que
ninguna llegó a rechazar código. Se registran porque el modo de fallo es el mismo y la ficha, tal
como estaba escrita, no habría avisado de ninguna de las dos.

### 1. La subcadena también aparece dentro de un valor FORMATEADO

Su criterio 21 exigía que dos filas **no** contuvieran `0,00` — la comprobación de que la pantalla
no está imprimiendo un importe de envío que no debería. Pero el subtotal «redondo» que él mismo
había puesto en la tabla de siembra, `"1400.00"`, se formatea `1.400,00`, **que contiene esa
subcadena**. El criterio habría rechazado una implementación perfecta.

Se corrigió el **dato de siembra** (a `"1437.25"`) y la redacción, no el diseño.

Es la primera vez que este modo de fallo aparece con un **número** en vez de con una frase, y la
lección generaliza más allá del copy:

> Una subcadena exigida por un criterio hay que buscarla también dentro de los **valores
> formateados** que la pantalla va a imprimir en esa misma vista —importes, cantidades, fechas—,
> no solo dentro del copy fijo. Y la tabla de siembra es parte del criterio: un dato de prueba mal
> elegido lo invalida igual que una redacción mal elegida.

### 2. `text-transform` de CSS no toca el `textContent`

`SectionLabel` pinta en mayúsculas **por CSS**. Si `productsSectionLabel` devolviera
`Productos (4)`, un criterio que buscara `PRODUCTOS (4)` estaría comparando contra un DOM que
guarda `Productos (4)`: lo que el navegador **enseña** y lo que el DOM **guarda** son cadenas
distintas. Habría rechazado código correcto.

Se resolvió haciendo que la función devuelva la cadena ya en mayúsculas — era el único rótulo del
documento cuyo texto se **calcula**; los demás son palabras fijas que ningún criterio lee por
`textContent`.

> Si un criterio lee `textContent`, compáralo con lo que el DOM guarda, nunca con lo que la
> captura enseña. `text-transform`, `::first-letter` y el contenido generado por CSS no están en
> el `textContent`.


---

## Adenda F-012 — dos variantes más, y una es al revés

### 3. La subcadena ya estaba en la página, puesta por el copy de OTRO feature

La peor hasta ahora, y la cazó el `ui-designer` repasando su documento antes de entregarlo.

Un criterio del `409` iba a exigir que la pantalla mostrara «falta cotizar el envío» tras provocar
ese error. Pero **F-011 ya imprime «Todavía falta cotizar el envío…»** en el bloque de importes de
**todo** pedido `PENDING_QUOTE` — que es exactamente el tipo de pedido sobre el que hay que
provocar el `409`. Escrito sobre `document.body`, el criterio **pasa con el `409` sin implementar**.

Es E-008 montado sobre E-016: el criterio no discrimina, y encima parece que sí. Se resolvió
acotando todos los criterios de esa zona a `section[aria-label="Acciones del pedido"]` y añadiendo
una guarda previa que comprueba que la frase **no** está en la región antes de pulsar.

> Antes de exigir una subcadena, búscala también en el copy que los features **anteriores** ya
> pintan en esa misma ruta. Un feature nuevo hereda toda la página, no solo su trozo. Y cuando un
> criterio busque texto, **acótalo a la región que ese criterio gobierna**, nunca a `document.body`.

Dos más del mismo repaso, menores pero del mismo origen: dos avisos nuevos empezaban con la misma
frase (un criterio del éxito daba positivo sobre el de divergencia), y la frase de `UNKNOWN_STATUS`
compartía prefijo con una de F-011 **y además era falsa** para `PENDING`, que sí está traducido. En
los tres casos se corrigió el copy, no el criterio.

### 4. Al revés: la subcadena PROHIBIDA aparece en tus propios comentarios

La encontró el `implementer`, y es el mismo mecanismo invertido. El diseño trae criterios de
**ausencia** verificables por `grep`: que no aparezca `wa.me`, ni `window.open`, ni
`CircularProgress` en los archivos nuevos.

Su código los cumplía. Su **documentación** no: había escrito `https://wa.me@attacker.example/` en
el JSDoc de la guarda (copiado del ADR que la justifica), «no `window.open`» en un comentario del
JSX, y «`CircularProgress`» en el del diálogo. Las tres frases son prosa correcta —explican
justamente por qué no se usa eso— y las tres son el literal exacto que el criterio busca.

> Un criterio de ausencia por `grep` tiene su trampa en los comentarios que explican esa misma
> ausencia. Si vas a prohibir un literal, decide si el criterio mira solo código o también prosa —
> y dilo en el criterio, porque el `grep` no distingue.


## Adenda F-023 — la subcadena prohibida escondida dentro de una palabra

Variante nueva del modo invertido: no es que falte una subcadena exigida, es que **sobra una
prohibida**, y no está en un comentario ni en un valor formateado. Está dentro de una palabra
corriente del copy.

El criterio 1 del backlog usa la cuenta `admin` del seed. Un criterio de ausencia razonable sería
«la tarjeta no muestra el nombre de usuario rechazado», es decir: `card.textContent` no contiene
`admin`. Pero el copy dice:

> «…o pídeselo a quien **administre** tu negocio.»

y `administre` contiene `admin`. El criterio habría rechazado una implementación perfecta.

Lo cazó el propio `ui-designer` al repasar su copy antes de entregarlo, y lo resolvió cambiando el
sujeto del criterio: se verifica con la cuenta `vendedor`, cuyo nombre no es subcadena de ninguna
palabra del copy. El `qa` lo ejecutó así y confirmó las dos mitades: la tarjeta no contiene
`vendedor`, y sí contiene `admin` —dentro de `administre`— exactamente como el documento predecía.

> Antes de escribir un criterio de ausencia sobre un nombre corto (`admin`, `id`, `pos`, `test`),
> búscalo como **subcadena** en el copy, no como palabra. Y prefiere como sujeto del criterio un
> valor que no sea subcadena de nada: la lista de cuentas del seed da donde elegir.

## Adenda F-036 — al revés del todo: el copy es correcto y el ANCLA está mal

Las cinco apariciones anteriores fallan por la **cadena**: no existe, existe dentro de un valor
formateado, la puso otro feature, o está escondida dentro de una palabra. La sexta falla por el
**nodo**, con la cadena impecable.

El contrato de interfaces mandó el **mismo `data-testid` en las tres apariciones** de cada columna
del histórico —el `<th>`, el `<td>` y el `Grid item` de la rama de tarjetas— para que el ancla
sobreviviera al cambio de rama responsive. Es una decisión buena. Y el criterio de diseño, escrito
antes de que existiera el DOM, hacía:

```js
collapse(document.querySelector('[data-testid="resumen-cierre-credit-granted"]').textContent)
  === "$1000,00"
```

`querySelector` devuelve **el primero del documento**, que es el `<th>`, cuyo texto propio es
`Crédito` — y es `Crédito` porque **lo exige el criterio de al lado, del mismo documento**. A 320 px
el ancla es el `Grid item`, cuyo `textContent` es `Ventas a crédito$1000,00`. El criterio rechaza
código correcto a los tres anchos, por dos motivos distintos.

Las dos mitades son defendibles por separado, y ahí está la trampa: no lo ve `tsc`, no lo ve
`lint`, y **no lo ve leer cualquiera de los dos documentos por separado**. Lo destapó el
`implementer` al ejecutar el contrato, no una revisión.

### Y no era un criterio: eran nueve

Cuando el `ui-designer` fue a buscar el **mecanismo** en el resto de sus criterios, en vez de
parchear el reportado, aparecieron tres familias más:

- El criterio de la fila «Totales» tenía el defecto **opuesto**: leía cifras de celdas que
  correctamente **no llevan ancla**, porque un `data-testid` identifica una columna, no una suma.
- Dos criterios comparaban «los `<th>` que llevan el ancla», que con tres nodos por ancla no
  quiere decir nada.
- **Tres criterios recorrían siete anclajes con `querySelector` y probaban un tercio de lo que
  decían — y nunca habían fallado, porque los tres nodos cumplen.** Es el modo de fallo peor: un
  criterio en verde que no verifica lo que dice.
- Uno del diálogo de recálculo estaba roto y **nadie lo había reportado**, escrito como si una
  forma de DOM sirviera a los tres anchos.

### La regla

> **Un `data-testid` que el contrato pone en varias ramas responsive es un ancla de CONTEO, y
> ningún criterio puede leer su `textContent`.** Se cuenta (`querySelectorAll().length`) o se
> cualifica por algo que distinga la rama —el `tagName`, un hijo que solo existe en una de ellas—,
> nunca se lee.

Y el corolario de método, que vale para toda la ficha: **cuando aparece uno, búscalo en los
demás.** Ocho de los nueve no los reportó nadie; salieron de repasar el mecanismo, no el síntoma.


---

## Adenda F-037 — un barrido de subcadenas no valida un **conteo**

Esta es la aparición más instructiva, porque el `ui-designer` **hizo el barrido que esta ficha
prescribe** —buscó a máquina cada subcadena exigida dentro del copy que él mismo dictaba— y el
defecto se le colό igual.

El criterio 25 pedía «**un** elemento con texto propio `200,00 CUP`». La subcadena existía en el
copy, así que el barrido dio verde. Pero la siembra tenía un abono de `monto 200` **en base** y su
línea de pago de `200 CUP`, y el propio § 4.1.2 del documento dictaba pintar **los dos** con la
moneda al lado: la pantalla monta **dos** nodos con esa cadena. El `implementer` implementó el
§ 4.1.2 al pie de la letra —que es lo correcto— y el criterio quedó incumplible.

**Lo que hay que añadir al barrido:** la subcadena y el **conteo** son dos comprobaciones distintas.
Que el texto exista no dice **cuántas veces** lo monta la pantalla con los datos de la siembra. Por
cada criterio de la forma «un elemento con texto X», recorre la siembra y cuenta **cuántos sitios
del propio contrato mandan pintar X**. Si son dos, el criterio es `=== 2`, o se acota con un filtro
—en F-037 quedó `.filter(el => !el.closest(".cc-venta-credito-pago"))`— y se dice contra qué.

Dicho corto: **el barrido valida la cadena; la siembra valida el número.** Sin el segundo, un
criterio con la cadena correcta sigue siendo inalcanzable.

## Adenda F-047 (2026-09-10) — dos formas más, y una de ellas por creerle a un JSDoc

**La granularidad del formateador.** `formatDateTime` produce `HH:mm:ss` —compone con `formatTime`,
que pide `second: "2-digit"`— mientras `formatTimeShort` da `HH:mm`. Un criterio de «la fila y el
diálogo muestran la misma hora» comparando la **cadena entera** rechaza la única implementación
posible con los formateadores que la pantalla ya usa: la fila pinta `22:00:00` y el diálogo
`22:00`. La comparación correcta es por `HH:mm`.

Lo instructivo es **de dónde salió el dato falso**: el JSDoc de `formatDateTime` dice
`(dd/mm/aaaa • HH:mm)` y **miente**. Quien escribió el criterio leyó el comentario y no el código.
Un comentario no es una fuente: **abre el formateador**.

**Una subcadena prohibida escondida dentro de otra palabra, otra vez.** Se iba a prohibir `sync` en
un criterio de ausencia sobre `src/app/ventas/`; el `grep` da seis coincidencias y **todas son de
`async`**. Es la misma forma que `administre` conteniendo `admin`, ya registrada arriba: antes de
prohibir una subcadena, búscala **en el código que la rodea**, no solo en el copy.

## Adenda F-050 (2026-09-11) — se grepeó el CALL SITE de la función, no el CONSUMO del campo

La variante más cara de todas hasta ahora, no por lo que costó arreglar —texto— sino por hasta
dónde llegó: **un hecho falso sobre lo que una pantalla pinta atravesó el spec, el contrato de
interfaces y un ADR aceptado**, y estuvo a punto de fijar la justificación de una decisión.

El spec de F-050 afirmaba que «Mis Ventas» del POS *«hoy ya pinta `(1 intentos)` en toda venta en
línea ordinaria»*, y lo daba por **verificado por `grep`**. La comprobación que lo respaldaba era:

```
grep -n "formatSaleInfo" src/app/pos/components/SalesDrawer.tsx
  595:  const saleInfo = formatSaleInfo(s);   ← rama móvil
  797:  const saleInfo = formatSaleInfo(s);   ← rama escritorio
```

Cierto, y **no prueba nada**: eso es el *call site* de la función, no el consumo de su resultado.
`formatSaleInfo` devuelve cuatro campos y la pantalla **lee dos**:

```
grep -n "saleInfo\." src/app/pos/components/SalesDrawer.tsx
  647:  {saleInfo.date}    841:  {saleInfo.products}    847:  {saleInfo.date}
```

`status` —el campo que llevaba `` (N intentos)``, el `syncState` crudo y el texto
*«Creada online/offline»*— **se compone y se descarta**. Nunca llegó al DOM. Y `total`, su vecino,
estaba igual de muerto: apareció al repetir la comprobación con los campos de al lado.

**Lo halló el `ui-designer`** al tocarle mirar esa pantalla, y lo verificó el coordinador antes de
pasarlo. No se buscaba: salió porque el mandato obligaba a describir lo que la pantalla enseña.

### Por qué es E-016 y no otra cosa

Es el mismo mecanismo de siempre —**una comprobación textual que casa con algo parecido a lo que se
quería comprobar**— un escalón más arriba: no es una subcadena dentro de otra palabra, es un
**símbolo dentro del ámbito equivocado**. `formatSaleInfo` aparece, sí, pero en la línea que la
llama, no en la que pinta. El resultado es idéntico al de las otras ocho apariciones: el documento
afirma algo del DOM que el DOM no sostiene.

### Cómo evitarlo, en un comando

> Para afirmar que una pantalla **pinta** algo, grepea el **consumo del campo**, no la llamada a la
> función que lo produce: `grep -n "<campo>" <archivo>`. **Si la única línea que sale es la que lo
> compone, no se pinta.**
>
> Y repítelo con los **campos vecinos del mismo objeto**: un objeto de presentación con un campo
> muerto suele tener más de uno, y así fue como apareció que `total` también lo estaba.

### Lo que salvó la decisión

Que el motivo estaba sobredeterminado. La línea había que borrarla igual, porque su gate
—`sale.syncAttempts > 0`— viola el criterio 8 de F-050 esté vivo o muerto el texto que alimenta.
**La decisión no cambió; cambió su motivo, y a uno más fuerte**: de «deja de pintar una cifra
ambigua» a «borra código muerto que además incumple un criterio». La pantalla cumplía el criterio 7
**por accidente** —bastaba escribir `{saleInfo.status}` en el JSX para romperlo— y pasa a cumplirlo
**por construcción**.

Si el motivo no hubiera estado sobredeterminado, el ADR habría quedado justificando una decisión
correcta con un hecho falso, que es la forma en que estos errores sobreviven a su corrección.

---

## Adenda (F-016): el punto ciego del comprobador, que no es una aparición más

**No incrementa `Apariciones`**: el copy de F-016 estaba bien y sus 18 subcadenas exigidas existen.
Lo que se descubrió es un límite de la herramienta que comprueba justamente esto.

`scripts/harness/check-design-copy.mjs` examina el documento **línea a línea**. Una aserción de copy
cuyo verbo de presencia y cuyo code span quedan en **líneas de markdown distintas** —por el ajuste
de márgenes al redactar, que es lo normal en un criterio largo— **no se comprueba en absoluto**: no
falla, no avisa, simplemente no entra en la cuenta.

La primera redacción del contrato de diseño de F-016 pasaba en verde con **4 aserciones examinadas
de unas 20**. Reescribir cada aserción de copy en una sola línea la subió a 18. El verde era el
mismo en los dos casos.

> **Una aserción de copy se escribe en UNA línea**, por larga que quede. Y el verde de
> `check-design-copy.mjs` se lee con su número al lado: si dice «N subcadenas comprobadas» y tu
> documento exige bastantes más, las que faltan no están verificadas — están invisibles.
