# E-011: `querySelector('.MuiContainer-root')` mide el contenedor del Layout, no el de la página

**Área:** ui
**Apariciones:** 2 — F-004 (paso 6, verificación del contrato de diseño) · F-006 (ver la adenda del final). En F-011 NO llegó a ocurrir: se anticipó en el contrato de diseño y el `qa` midió con el filtro correcto. Ver la adenda de F-011 al final.

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
