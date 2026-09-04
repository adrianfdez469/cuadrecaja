# E-020: Estimar líneas o alto en un criterio de diseño cuando el contenedor tiene el ancho acotado

**Área:** ui
**Apariciones:** 1 — F-020 (criterios de diseño 112 y 122)

## Síntoma

Dos criterios de diseño **fallan contra una implementación correcta**. Medido en el navegador con
sonda de viewport, sin truncamiento ni desbordamiento en ningún ancho:

```
Criterio 112 — exige «≤ 2 líneas a 768 px».   Real: 320→6, 768→3, 1440→2.
Criterio 122 — exige que el alto «decrezca estrictamente» al ensanchar.
               Real: 91 px a 768 px y 91 px a 1440 px. No decrece: se queda igual.
```

## Causa raíz

La pantalla vive dentro de un `Container maxWidth="md"`. **Por encima de ese tope, ensanchar el
viewport no ensancha la caja del texto**, así que el párrafo no gana ni pierde líneas entre 768 y
1440 px. «Decrece estrictamente» es una promesa que el contenedor no puede cumplir, por correcto que
sea el componente.

El número se escribió estimando a ojo, antes de que la pantalla existiera —que es lo que hace un
contrato de diseño—, y el `maxWidth` se heredaba de otro feature, así que no estaba a la vista de
quien escribía el criterio.

## Solución

Reescribir los dos criterios contra **lo que protegían de verdad**, dejando anotada la medición real
de los tres anchos para que el siguiente compare contra un número medido y no contra una estimación.
El fondo de los dos era: que no haya desbordamiento horizontal, que no se trunque ni se pierda
texto, y que el bloque **no crezca** al ensanchar. El número de líneas era el proxy, y era el proxy
equivocado.

## Cómo evitarlo

Las tres reglas son del `ui-designer` que escribió los dos criterios, redactadas después de
corregirlos.

**1. Un criterio de alto se escribe en dos mitades, y solo una necesita haber renderizado.**

- La **invariante** se puede escribir a ciegas y se cumple sola en el caso bueno: mismas palabras en
  los tres anchos, texto completo (`scrollHeight === clientHeight`, `text-overflow` ≠ `ellipsis`,
  sin `line-clamp`, sin `nowrap`), sin desbordamiento horizontal, y **el alto no aumenta al
  ensanchar**.
- El **tope absoluto** se deja escrito como hueco —«≤ ___ líneas, a rellenar al medir»— y se
  rellena en el ciclo de verificación con el número medido más una línea de holgura. **Un contrato
  con el hueco declarado es honesto; uno con el hueco rellenado a ojo firma un rechazo falso.** Y un
  `passes` no debería poder cerrarse dejando huecos sin rellenar.

**2. La monotonía se declara por tramos, no entre extremos.** «No aumenta» en todo el rango, y
estricta **solo en el tramo donde el ancho de caja crece de verdad**. Ese tramo se calcula antes de
escribir el criterio: ancho de caja = el menor de (viewport, `maxWidth` del contenedor) − paddings.
Aquí eran 280 → 672 → 804 px, y con esos tres números delante el fallo era evidente: el salto de 768
a 1440 vale un 20 % de ancho, y un 20 % no le quita una línea a un párrafo de 272 caracteres.
**La regla operativa: escribe el ancho de caja junto a cada viewport dentro del propio criterio.**
Estaban calculados en las secciones de layout y no se llevaron al criterio; puestos ahí, la
desigualdad estricta entre los dos últimos anchos no habría sobrevivido a leerla.

**3. Al aflojar una desigualdad, haz inventario de qué dejaba de cubrir.** Una desigualdad estricta
suele probar dos cosas a la vez, y al relajarla solo se conserva una. Aquí probaba «no crece» **y**
«el bloque refluye en vez de reestilarse»; la segunda hubo que reponerla con un criterio nuevo de
estilos computados idénticos entre anchos. **Relajar un criterio sin ese inventario es cómo un
contrato pierde cobertura sin que nadie lo note.**

Y no midas nada con `resize_window` ([E-005](E-005-resize-window-no-cambia-el-viewport.md)): el
viewport no cambia y el número que salga será falso en la otra dirección.
