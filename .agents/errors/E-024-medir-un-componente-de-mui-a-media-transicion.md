# E-024: Medir un componente de MUI a media transición devuelve una caja escalada

**Área:** ui
**Apariciones:** 1 — F-006

## Síntoma

El `qa` mide la altura de las opciones de un `Select` y obtiene **34,5 px** contra un criterio que
exige ≥ 44. El `implementer` mide lo mismo y obtiene, según el instante, 24,8 px, ~34,5 px o 44 px:

```
li[role="option"] → getBoundingClientRect().height = 34.5   // a media animación
li[role="option"] → getBoundingClientRect().height = 24.9   // primer frame
li[role="option"] → getBoundingClientRect().height = 44.0   // ya estabilizado
```

## Causa raíz

El `Menu` de MUI se abre con una transición `Grow` que arranca en `scale(0.75, 0.5625)` y crece
hasta `scale(1)`. `getBoundingClientRect()` devuelve la caja **después de aplicar el `transform`**,
así que durante la animación mide el tamaño escalado, no el real.

Lo traicionero es que **la cifra intermedia es plausible**: 44 × 0,78 ≈ 34,5 es exactamente el
tipo de número que parece «un `minHeight` que no se aplicó» en vez de «una medición prematura».

En F-006 las dos cosas coincidieron: había un bug real (`MenuItem` trae una variante
`[breakpoints.up('sm')]: { minHeight: 'auto' }` que ganaba por orden de fuente a la clase generada
por `sx`) **y** la medición se estaba tomando durante la transición. El número por sí solo no
distinguía una causa de la otra, y se confirmó cuál era revirtiendo el arreglo y comprobando que
el `min-height` computado valía `0px`.

## Solución

Medir algo que el `transform` no afecte, o esperar a que la caja se estabilice:

```js
// Fiable durante la animación:
getComputedStyle(li).minHeight   // "44px" desde el primer frame

// No fiable hasta que la transición termina:
li.getBoundingClientRect().height
```

El criterio 20 de `.agents/designs/F-006.md` lo dice ahora explícitamente.

## Cómo evitarlo

**Un criterio de diseño que mide un componente con transición de entrada —`Menu`, `Dialog`,
`Popover`, `Drawer`, `Tooltip`, cualquier `Grow`/`Zoom`/`Fade`— tiene que decir con qué se mide.**
Si mide caja, tiene que exigir que la animación haya terminado; si quiere ser robusto, que lea la
propiedad computada, a la que el `transform` no afecta.

**Medir dos veces seguidas no basta**: si las dos caen dentro de la animación, confirman el mismo
valor equivocado.

Y cuando una medida falle un criterio, **antes de declarar bug, comprobar que la medida es
estable**. Hermano de [E-011](E-011-medir-el-contenedor-equivocado-de-mui.md): la medida es
plausible y apunta al sitio equivocado.
