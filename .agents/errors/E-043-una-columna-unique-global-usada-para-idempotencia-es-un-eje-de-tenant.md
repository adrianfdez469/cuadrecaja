# E-043: Una columna `@unique` global usada para idempotencia es un eje de tenant más

**Área:** prisma
**Apariciones:** 1 — F-021

## Síntoma

Al cerrar por tenant una ruta de venta, la guarda nueva funciona: un `tiendaId` ajeno da 404. Pero
la ruta sigue teniendo una puerta abierta que **la propia corrección acaba de volver alcanzable**.

## Causa raíz

`Venta.syncId` es `@unique` **global**, no por tenant — es el mecanismo de idempotencia de la
sincronización offline. Así que:

```ts
prisma.venta.findUnique({ where: { syncId } })   // devuelve la venta de CUALQUIER negocio
```

Y el camino por el que se llega ahí era el peor posible: **la recuperación del `P2002`**. Al cerrar
la ruta por `tiendaId` sin cerrar también el `syncId`, ese `catch` pasó de ser prácticamente
inalcanzable a ser alcanzable **justo cuando la guarda nueva hacía su trabajo** — y devolvía la
venta del otro negocio.

**Cerrar la puerta de delante y dejar abierta la de atrás es peor que no cerrar ninguna**, porque
nadie vuelve a mirar una puerta que ya se dio por cerrada.

## Solución

Plegar el `syncId` al tenant en las dos rutas de venta (web y APK), **incluido el camino de
recuperación del error**: el `findUnique` pasa a ser un `findFirst` con el filtro de tenant, y el
`catch` del `P2002` usa la misma consulta acotada.

## Cómo evitarlo

**Toda columna `@unique` global usada para idempotencia es un eje de tenant más, y hay que plegarla
también en el camino de recuperación del error.**

Y, más en general: al cerrar una ruta, **mira qué caminos se vuelven alcanzables por haberla
cerrado**. Una guarda nueva cambia qué ramas se ejecutan; las que antes eran teóricas dejan de
serlo. Es pariente de [E-032](E-032-una-guarda-mas-ancha-que-la-del-contrato.md) por el lado
contrario: allí sobra rama y nadie la prueba; aquí una rama que nadie probaba pasa a ejecutarse.

Ver también [E-038](E-038-el-p2002-no-se-recupera-dentro-de-la-transaccion.md), que es el otro
error de esta misma familia: el `catch` de un `P2002` es un sitio donde pasan cosas que nadie mira.
