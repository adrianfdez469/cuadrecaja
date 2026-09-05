# E-037: Un criterio de diseño con una premisa física falsa sobre un componente compartido

**Área:** ui
**Apariciones:** 1 — F-009

## Síntoma

Un criterio de diseño exige que el ancho de la caja de contenido sea el mismo a **768** y a
**1440 px** (±2 px), porque «el `Container` está topado en `md`».

Medido por el `qa`:

```
inner a  768 px → 646
inner a 1440 px → 802     (156 px de diferencia)
```

El criterio falla **contra una implementación correcta**, que además reutiliza fielmente el mismo
`PageContainer` que ya usaban F-004 y F-005.

## Causa raíz

**El número estaba bien medido. La premisa era falsa.**

`Container maxWidth="md"` de MUI **no topa siempre**: aplica su `max-width` **desde su propio
breakpoint hacia arriba**. Medido sobre `.MuiContainer-maxWidthMd`:

| Viewport | `max-width` computado | `clientWidth` |
|---|---|---|
| 768 px | `none` | 744 |
| ≥ 900 px | `900px` | 900 |

Por debajo de `md` (900 px) el contenedor es **fluido**. Así que 768 y 1440 no están en el mismo
régimen y no son comparables: el criterio comparaba dos cosas distintas creyendo que eran la misma.

La frase que alimentó el error estaba **una sección antes**: el layout de 768 px decía que el ancho
del botón era «el único cambio», a secas. Si nada más cambia, parece razonable deducir que la
medida ya está topada.

## Solución

Reescribir el criterio contra el tope real, sin renunciar a lo que quería garantizar:

> La tarjeta no se estira sin límite en pantallas grandes: **desde 900 px su medida está
> congelada**. Se verifica **entre 1440 y 1920 px**, que es donde el tope existe.

Re-verificado ejecutando: `maxWidth`, `clientWidth` e `inner` **idénticos** a 1440 y a 1920.

Y se añadió al documento el párrafo que explica por qué **no** se compara contra 768, con los 156 px
nombrados como comportamiento esperado — para que nadie vuelva a escribir la comparación inversa.

## Cómo evitarlo

**Antes de afirmar «a estos dos anchos pasa lo mismo», hay que saber dónde está la frontera del
componente que lo decide, no dónde está el umbral responsive de la pantalla.**

Es pariente de [E-020](E-020-estimar-lineas-o-alto-con-un-contenedor-acotado.md), pero no es el
mismo error y por eso lleva ficha aparte:

- En E-020 el fallo es **estimar sin medir**.
- Aquí se midió bien, y el fallo fue **razonar sobre una regla del componente que nunca se
  comprobó**. Ninguna cantidad de rigor al medir lo habría detectado.

Corolario para quien escriba criterios: un criterio que compara dos viewports solo vale si los dos
caen del mismo lado de todas las fronteras que intervienen — las del layout propio **y** las que
traen los componentes de terceros.
