# E-062: Una desigualdad estricta entre el `bottom` y el `top` de dos hermanos de flujo normal

**Área:** ui
**Apariciones:** 1 — F-030 (criterio de diseño 49)

## Síntoma

Un criterio de diseño exige que el `top` de un elemento sea **mayor** que el `bottom` del elemento
anterior:

> «...el `top` del separador es **mayor** que el `bottom` de la fila de A»

Medido con Playwright a los tres anchos, son **iguales al píxel**: `369.140625` a 768 y 1440,
`425.3125` a 320. El criterio rechaza una implementación **correcta**, y el rechazo señala a código
que no tiene nada que arreglar.

## Causa raíz

Los dos elementos son **hermanos de flujo normal dentro de un contenedor sin `gap` ni margen entre
ellos**. En ese layout `siguiente.top === anterior.bottom` no es una coincidencia: es una
**propiedad estructural**. Ninguna implementación del layout puede dar la desigualdad estricta sin
introducir un hueco visual que nadie pidió — y en este caso el propio contrato declaraba ese layout
**intocable** en su sección «Lo que NO cambia», así que el criterio exigía algo que el mismo
documento prohibía.

Lo que el criterio pretendía comprobar —que el separador cae entre A y B— **sí era cierto y sí
quedó verificado**. Lo que estaba mal era la comparación.

## Solución

`>=` en lugar de `>`. Y dejar escrita la cifra medida junto al criterio, para que el siguiente
lector no vuelva a asumir la relación.

## Cómo evitarlo

**Al escribir una comparación de posiciones, pregúntate qué elemento hay en medio.** Si la
respuesta es «ninguno», la comparación es `>=`:

- `bottom` contra `top` de dos hermanos consecutivos, sin `gap` ni margen → **siempre `>=`**.
- `top` contra `top` de dos elementos separados por un tercero con alto propio → la desigualdad
  estricta **sí** se sostiene, y relajarla a `>=` vuelve el criterio **vacuo**. Escribir al lado
  qué elemento media es lo que impide que alguien lo «arregle».

Es primo de [[E-020]] —una cifra sobre el layout escrita sin medirla— con una variante peor: allí
se estima un número, aquí se asume una **relación** entre dos cajas. El síntoma es el mismo y más
difícil de ver: el criterio es plausible, nadie lo cuestiona al leerlo, y falla contra código
correcto.
