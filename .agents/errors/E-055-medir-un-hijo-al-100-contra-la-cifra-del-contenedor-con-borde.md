# E-055: medir un hijo al 100 % contra la cifra del contenedor que declara borde

**Área:** ui
**Apariciones:** 1 — F-025

## Síntoma

Un criterio de diseño fijaba el alto del hueco del mapa en **240 px** a 320 px de ancho. Al medirlo,
el esqueleto de carga —y también `.leaflet-container` y el panel degradado, los tres— daban
**238 px**. Dos píxeles de diferencia, en un criterio que el propio documento había medido bien.

## Causa raíz

El contenedor declara `border: 1px solid` y `box-sizing: border-box`, así que su caja externa mide
240 px y su **caja de contenido** mide 238. Cualquier hijo con `height: 100%` hereda **238**, no 240.

El criterio comparaba **el elemento interior** contra la cifra del **exterior**.

No es E-037 —la premisa física es correcta y el borde existe porque el propio contrato lo pide— ni
E-020 —sí se midió, no se estimó—. Es un caso distinto: **la cifra es del contenedor y la medición
es del contenido**, y entre las dos hay exactamente el ancho del borde que el mismo documento
especificó dos párrafos antes.

## Solución

Se verificó el invariante que de verdad importaba —«el hueco no reflota la página al cambiar de
estado»— con una medida **sin esa ambigüedad**: el `top` del primer campo de coordenadas es
**idéntico bit a bit** (`2293.140625`) en los tres estados (cargado, cargando, degradado). Y el
hueco en sí (`.cc-store-map`) mide 240 / 320 / 360 exacto en los tres, que es lo que el criterio de
estructura pedía.

No se rechazó por los dos píxeles.

## Cómo evitarlo

**Cuando un criterio da una cifra de alto o de ancho, di contra qué elemento se mide.** «El hueco
mide 240» y «el esqueleto mide 240» no son la misma afirmación en cuanto el hueco tiene borde.

Dos formas de escribirlo sin ambigüedad:

- medir **el mismo elemento** que declara la cifra (el contenedor), o
- expresar la relación en vez del número: **el rect del hijo coincide con la caja de contenido de
  su contenedor**, que es cierto con borde y sin él.

La segunda es preferible cuando lo que importa es «llena el hueco», que casi siempre es el caso
real. Y si de verdad hace falta el número del interior, **réstale el borde y dilo**.

Hermano de **E-048**: allí un contenedor nuevo atrapaba el margen de su hijo; aquí un borde del
contenedor desplaza la medida del hijo. Las dos veces, la caja intermedia es la que nadie contó.
