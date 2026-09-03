# E-005: `resize_window` no cambia el viewport, y la verificación responsive da un falso aprobado

**Área:** ui
**Apariciones:** 1 — harness (paso 4b de `qa`)

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
