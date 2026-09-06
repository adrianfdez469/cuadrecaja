# E-048: Un contenedor "sin estilos" que es hijo de un flex atrapa el margen de SU hijo, y su altura deja de coincidir con la de él

**Área:** ui
**Apariciones:** 1 — F-024

## Síntoma

El contrato de diseño de F-024 (`.agents/designs/F-024.md`, criterio 2) afirma que la `section`
nueva "no aporta caja propia" y que su `getBoundingClientRect()` coincide con el de su único hijo
(la rejilla de `StatStrip`) en `top`, `left`, `width` **y `height`, ±1 px**.

Medido con Playwright contra `/dashboard-resumen` real (`newContext({ viewport })`, nunca
`resize_window`, E-005):

```
regionRect.height = 153.171875
gridRect.height   = 129.171875   // difiere en exactamente 24px, no ±1px
```

`padding`, `border-width` y `background-color` de la `section` sí son los de un contenedor sin
estilos (`0px`, `0px`, `rgba(0,0,0,0)`), tal como pedía el criterio. Solo `height` falla.

## Causa raíz

`StatStrip` (el hijo directo de la nueva `section`) trae `mb: 3` (24px) como margen **propio**
(`src/components/StatStrip.tsx:83,115`). Antes de F-024, `StatStrip` era hijo directo del `Stack`
de la página (`display:flex`), así que ese margen era el margen de un ítem flex: no colisiona con
el margen de otros ítems flex (los contenedores flex no colapsan márgenes entre ítems), y por
definición un margen nunca infla el propio `getBoundingClientRect()` del elemento que lo lleva.

F-024 envuelve `StatStrip` en `<section>`, y esa `section` —no `StatStrip`— pasa a ser el ítem flex
directo del `Stack`. Un ítem flex establece un contexto de formato de bloque (BFC) para **su
propio contenido**: el margen inferior de un hijo bloque ya no colapsa "a través" del padre ni se
escapa por debajo de él. Eso significa que el `mb:3` de `StatStrip`, que antes escapaba fuera de su
propia caja (por ser él mismo el ítem flex), ahora queda **atrapado dentro** de la caja de la
`section` que lo envuelve — inflando la altura de la `section` exactamente en esos 24px.

Verificado con una medición aparte (`gridMarginBottom: "24px"`, `regionMarginBottom: "0px"`,
`parentDisplay: "flex"`) y comprobando que el hueco visual hacia el siguiente hermano de la fila
**no cambió** respecto al que había antes de F-024 (`gapGridBottomToNext = 56px`, la misma suma de
siempre: 24px del propio margen de `StatStrip` + 32px del spacing del `Stack`). El layout real no
se movió ni un píxel; lo que cambió es cuál elemento "contabiliza" esos 24px en su propia caja.

## Solución

No aplica corrección de código: la implementación es correcta y sigue el contrato al pie de la
letra (una `section` sin ningún estilo propio). El defecto está en el criterio 2 del documento de
diseño, que asume —sin comprobarlo contra el mecanismo real— que envolver un elemento en un
contenedor sin estilos preserva su `height` medido. No lo hace en cuanto el contenedor envolvente
pasa a ser el ítem flex/grid y el hijo lleva un margen propio.

## Cómo evitarlo

Un criterio de diseño que compare `getBoundingClientRect()` de un contenedor nuevo con el de su
hijo debe **restringir la comparación a lo que de verdad garantiza "sin estilos propios"**:
`padding`, `border-width` y `background-color` computados, más `top` y `left` (que sí coinciden
siempre que no haya padding/border). **No `height` ni `width` cuando el hijo lleva su propio
margen**, salvo que el criterio compruebe antes, contra el componente compartido real, si ese hijo
es hoy un ítem flex/grid directo del padre anterior (en cuyo caso envolverlo en un contenedor
bloque **atrapa** su margen) — exactamente el tipo de comprobación que ya pide E-037 para
"premisas físicas": medir el mecanismo en el código real, no asumirlo. Emparentado con E-037: aquí
el número también estaba mal — no por error de medición, sino porque la premisa ("envolver sin
estilos no cambia nada medible") es falsa para esta combinación concreta de flexbox y margin.
