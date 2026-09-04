# E-005: `resize_window` no cambia el viewport, y la verificación responsive da un falso aprobado

**Área:** ui
**Apariciones:** 2 — harness (paso 4b de `qa`), F-004

## Síntoma

La herramienta informa de éxito:

```
Successfully resized window containing tab 935492206 to 320x720 pixels
```

Pero la página sigue renderizando el layout de escritorio, y la captura vuelve a 1559×784. Medido
desde la propia página:

```json
{ "outerWidth": 780, "innerWidth": 2560, "clientWidth": 2545, "mobileMQ": false }
```

`mobileMQ` es `window.matchMedia('(max-width: 599.95px)').matches`, es decir el
`theme.breakpoints.down("sm")` de MUI. Con la ventana supuestamente a 320 px, **evalúa `false`**.

## Causa raíz

`resize_window` actúa sobre la ventana del navegador (`outerWidth` sí cambia), pero el viewport de
renderizado no la sigue: `innerWidth` se queda en 2560. Las media queries de CSS y `useMediaQuery`
evalúan contra el viewport, no contra la ventana, así que **el layout nunca conmuta a móvil**.

Lo peligroso no es que falle, es que *no lo parece*: se obtienen tres capturas, las tres válidas
como imagen, y las tres del mismo layout ancho. Quien las mira firma que la pantalla es responsive
sin haberla visto nunca en móvil. Es el mismo modo de fallo que [E-002](E-002-servidor-dev-con-cliente-prisma-viejo.md):
la verificación se ejecuta, devuelve algo, y ese algo no prueba lo que se cree.

## Solución

Renderizar la pantalla en **iframes**, que sí tienen viewport propio. Verificado el 2026-09-02
sobre `/login` en el dev server: los tres anchos dieron layouts distintos de verdad —marca apilada
arriba a 320 y 768 (`AuthCardLayout`), split con la marca a la izquierda a 1440
(`AuthSplitLayout`)—, y la sonda devolvió:

```json
[{"w":"320","innerWidth":320,"mobileMQ":true},
 {"w":"768","innerWidth":768,"mobileMQ":false},
 {"w":"1440","innerWidth":1440,"mobileMQ":false}]
```

El script completo está en `.claude/agents/qa.md`, paso 4b del protocolo.

## Cómo evitarlo

**Antes de leer una captura responsive, comprobar que el viewport es el que se cree.** La sonda
devuelve `innerWidth` y `mobileMQ` por ancho: si el iframe de 320 no da `mobileMQ: true`, no se
está verificando nada y la captura no vale. Nunca usar `resize_window` para verificar un diseño
responsive.


---

## Adenda (F-004): la segunda forma de falsear el viewport

El iframe tiene viewport propio, pero **eso no basta si el contenedor lo comprime**. Montando el
trío 320/768/1440 en un wrapper flex sin `flex: 0 0 auto`, los tres iframes reportaron:

```json
[{"w":"320","innerWidth":300},{"w":"768","innerWidth":300},{"w":"1440","innerWidth":445}]
```

Un `width` explícito en el iframe **no gana** al `flex-shrink: 1` que flexbox aplica por defecto.
El resultado es el mismo falso aprobado que documenta esta ficha, por una causa distinta: tres
capturas válidas como imagen, ninguna del ancho que se cree.

El script de referencia del paso 4b de `.claude/agents/qa.md` **ya incluye `flex: 0 0 auto`**. Se
perdió al reescribir el script a mano, «simplificándolo». De ahí la regla: ese estilo no es
decorativo y no se quita.

**Lo que salvó la verificación fue la sonda, no la vista.** Las capturas parecían correctas; el
`innerWidth` no lo era. Por eso la sonda se lee **antes** que la captura, siempre, sea cual sea el
método de montaje.
