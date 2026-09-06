# E-037: Un criterio de diseño con una premisa física falsa sobre un componente compartido

**Área:** ui
**Apariciones:** 2 — F-009 · F-024 (con mecanismo propio, documentado aparte en [E-048](E-048-el-item-flex-atrapa-el-margen-de-su-hijo.md); ver la adenda del final)

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

## Adenda F-024 — la misma forma, otro mecanismo: el margen que atrapa un ítem flex

Se repitió exactamente igual, y en un documento que **cita este mismo error**. El contrato de
diseño de F-024 exigía que una `section` nueva «sin estilos propios» coincidiera con su único hijo
en `top`, `left`, `width` y `height`, ±1 px. Lo hace en tres de los cuatro: `height` difiere en 24
px clavados.

No falla la medición —el `qa` midió con Playwright y viewport real— ni la implementación, que
seguía el contrato al pie de la letra: `padding`, `border-width` y `background-color` de la
`section` son efectivamente los de un contenedor sin estilos. Falla la **premisa**: «sin estilos
propios» no implica «sin caja propia» cuando el hijo trae un margen y el contexto de formato
cambia. El mecanismo exacto está en E-048.

Lo que generaliza, y es lo que vale la pena llevarse:

> «Este elemento no aporta caja» es una premisa **física**, no una propiedad de la hoja de estilos
> que escribes. Depende del hijo y del contexto de formato del padre, no solo de lo que tú
> declaras. Si un criterio va a comparar dos cajas, mide las dos **antes** de escribirlo — y si no
> puedes medirlas, afirma lo que sí controlas (padding, borde, fondo, el hueco visible al hermano)
> en vez de una igualdad de geometría.

Y el matiz que lo hace difícil de ver: F-024 documentaba E-037 en su propia tabla de absolutos. No
basta con conocer el error para no cometerlo — hay que medir.

