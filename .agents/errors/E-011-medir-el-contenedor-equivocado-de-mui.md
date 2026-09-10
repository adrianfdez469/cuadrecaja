# E-011: `querySelector('.MuiContainer-root')` mide el contenedor del Layout, no el de la página

**Área:** ui
**Apariciones:** 4 — F-004 (paso 6, verificación del contrato de diseño) · F-006 (ver la adenda del final) · F-023 (el snippet venía **escrito en el propio contrato de diseño**; ver la adenda del final). En F-011 NO llegó a ocurrir: se anticipó en el contrato de diseño y el `qa` midió con el filtro correcto. Ver la adenda de F-011 al final. · F-035 (la variante **estructural**: tres criterios del mismo documento apuntando a un nodo que no existe; ver la adenda de F-035 al final).

## Síntoma

Al verificar el criterio de diseño «el contenedor de `/tienda-online/configuracion` topa en
`maxWidth="md"`», la medición devuelve el ancho equivocado y el criterio parece incumplido:

```js
document.querySelector('.MuiContainer-root').getBoundingClientRect().width
// 1416  ← se esperaba 900
```

La pantalla está bien. Lo que está mal es la medición, y cuesta un ciclo de diagnóstico completo
descubrirlo, porque el número es plausible: 1416 es exactamente el `maxWidth="xl"` de la otra
pantalla del feature, así que parece que el implementador copió el valor equivocado.

## Causa raíz

`src/components/Layout.tsx` **ya envuelve todo `children` en su propio
`<Container maxWidth="xl">`** (línea ~1436, preexistente, ajeno al feature que se esté
verificando). Así que en cualquier página de la aplicación hay **dos** `.MuiContainer-root`
anidados, y `querySelector` —que devuelve el primero en orden de documento— encuentra siempre el
externo, el del Layout, nunca el de `PageContainer`.

El fallo no es del selector: es de dar por supuesto que la pantalla que se verifica es la única
que monta un contenedor.

## Solución

Medir el contenedor **anidado**, no el primero que aparezca:

```js
// el de la página es el que tiene un ancestro .MuiContainer-root
[...document.querySelectorAll('.MuiContainer-root')]
  .filter(el => el.parentElement.closest('.MuiContainer-root'))
  .map(el => el.getBoundingClientRect().width)
```

o, más directo, filtrar por la clase de anchura esperada
(`.MuiContainer-maxWidthMd` / `.MuiContainer-maxWidthXl`), que además hace explícito en la propia
sonda qué se está verificando.

## Cómo evitarlo

**Antes de medir un elemento por su clase en una aplicación con layout compartido, contar cuántos
hay.** Un `querySelectorAll(...).length` de una línea distingue «medí lo que quería» de «medí el
primero que había»:

```js
document.querySelectorAll('.MuiContainer-root').length   // > 1 → querySelector miente
```

Es la misma familia que [E-005](E-005-resize-window-no-cambia-el-viewport.md) y
[E-002](E-002-servidor-dev-con-cliente-prisma-viejo.md): la verificación **se ejecuta, devuelve un
número, y ese número no mide lo que se cree**. Un valor plausible es más peligroso que un error,
porque nadie lo cuestiona — aquí llevaba directo a rechazar una implementación correcta.


---

## Adenda (F-006): también pasa con las búsquedas por texto, no solo con las medidas

Verificando el criterio 16 —«la pestaña Productos no muestra el cuerpo de F-005»— una búsqueda
ingenua por `aria-label*="local"` y por el texto «local» dio **falsos positivos** que costaron tres
pasadas de diagnóstico aislar:

- productos de fixture llamados `Sin-Local` y `LocalNoPublicado`, que son nombres libres escritos
  por el propio `qa`;
- el nombre de la tienda actual, que pinta el `<header>` global del `Layout`, **fuera de la ruta**.

Ninguno era el `LocalSelector` que el criterio buscaba.

**La regla generaliza más allá de medir:** en una aplicación con layout compartido, **cualquier**
verificación por subcadena de texto o por selector tiene que acotarse al contenedor de la ruta
—en este proyecto, el `.MuiContainer-maxWidthMd` anidado— y **nunca** a `document.body`. Los nombres
libres que escriben los usuarios (o los fixtures) y el chrome del Layout compiten por las mismas
palabras.

Ver también [E-027](E-027-medir-un-componente-de-mui-a-media-transicion.md), la variante temporal
del mismo problema: la medida es correcta, pero se toma en el instante equivocado.

---

## Adenda F-011 — cuando filtrar por clase funciona *hoy* y por accidente

No llegó a ocurrir: el `ui-designer` lo anticipó en su contrato y el `qa` midió con el filtro de
anidamiento. Se anota porque el matiz es nuevo y hace la trampa **menos** visible, no más.

En F-011 la página del listado usa `maxWidth="lg"` y el `Layout` sigue en `maxWidth="xl"`, así que
un `querySelector('.MuiContainer-root.MuiContainer-maxWidthLg')` **encuentra el contenedor
correcto**. Es decir: filtrar por clase funciona, y por eso es peligroso — pasa la verificación,
nadie lo revisa, y se rompe en silencio el día que alguien iguale los dos `maxWidth` o cambie el
del `Layout`. La medida seguiría siendo plausible.

> El filtro correcto sigue siendo el de **anidamiento** (el contenedor de la página es el que está
> DENTRO del del `Layout`), no el de clase. Que el filtro por clase acierte hoy es una propiedad
> de los valores actuales, no del DOM.


## Adenda F-023 — el snippet equivocado venía dentro del propio contrato de diseño

La vuelta de tuerca: aquí no fue el `qa` quien eligió mal el selector. El selector **venía escrito
en `.agents/designs/F-023.md`**, como ayuda para localizar el elemento del criterio 15:

```js
const notice = svg.closest("div");   // NO es el bloque tintado
```

`svg.closest("div")` encuentra el `Stack` interno, que es **transparente**. El `Box` con el
`bgcolor` está dos niveles más arriba. Ejecutado literalmente, el snippet mide `rgba(0, 0, 0, 0)`
en los cuatro estados, los cuatro salen iguales, y el criterio «cada estado tiene su tinta»
**parece fallar contra una implementación correcta**. Costó un ciclo completo de depuración.

Lo que lo hace peor que las apariciones anteriores: un `ui-designer` que da el snippet cree estar
*eliminando* la ambigüedad, y el `qa` que lo ejecuta cree estar siguiendo el contrato. Los dos
actúan bien. La ayuda es el error.

> Un snippet de localización dentro de un contrato de diseño es **especificación ejecutable**, y
> hay que verificarlo contra el DOM real igual que cualquier otro criterio. Si no se puede
> verificar al escribirlo, describe el elemento por lo que ES (el bloque que lleva el `bgcolor`),
> no por cómo llegar a él desde un icono.


---

## Adenda F-035 — la variante estructural: tres criterios sobre un nodo que no existe

Las tres apariciones anteriores eran **el selector equivocado**: se medía el contenedor de fuera en
vez del elemento buscado. En F-035 el defecto fue **de reparto**, y no lo arregla ningún selector.

El contrato de diseño exigía, sobre el chip de estado de crédito:

- criterio 6 — que el elemento con **texto propio** llevase la clase `cc-venta-credito-chip`,
- criterio 8 — leer el `background-color` **de ese mismo** elemento,
- criterio 5 — contarlo una vez por venta.

Sobre un `Chip` de MUI **no existe tal elemento**: `Chip.js:298` declara `ChipLabel` como un
`<span>` propio y `:467` lo renderiza envolviendo el `label`, así que **el color va en la raíz y el
texto en el hijo**. El nodo que tiene el color no tiene texto propio, y el que tiene texto propio no
tiene el color. Los tres criterios eran incumplibles **juntos**, y cada uno por separado parecía
razonable.

El `implementer` lo pagó en tres intentos: pasar `className` a `StatusPill` —que **no lo acepta**— y
luego dejar la clase en la raíz, donde el `ownTextEquals` del criterio 6 nunca la encuentra.

**La corrección elegida fue un nodo único, no dos clases**, y la razón vale más que el arreglo: con
dos clases los tres criterios pasarían, pero F-036 va a reutilizar ese mismo chip **sin leer este
documento** y tendría que averiguar cuál de las dos mide qué. El contrato de diseño ganó una
subsección «Un solo nodo, y **no** envuelve `StatusPill`» con las dos razones verificadas, para que
nadie lo revierta por parecer más idiomático.

**Lo que generaliza:** antes de escribir varios criterios sobre «el chip» o «el badge», comprueba en
el `node_modules` real **cuántos nodos** monta ese componente y **qué lleva cada uno**. Si la clase,
el texto y el color no caen en el mismo elemento, o los criterios se reparten nombrando cada nodo, o
el componente se colapsa a uno. Decidirlo al escribir el contrato cuesta un `grep`; descubrirlo en
el paso 5 cuesta tres intentos y una enmienda.
