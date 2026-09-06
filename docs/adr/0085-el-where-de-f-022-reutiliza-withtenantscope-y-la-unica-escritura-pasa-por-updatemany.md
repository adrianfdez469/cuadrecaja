# ADR 0085: El `where` de F-022 reutiliza `withTenantScope`, no amplía `TENANT_RELATION_PATH`, y la única escritura pasa por `updateMany`

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-022

## Contexto

F-022 tiene que meter `negocioId` en `where`s de tres modelos distintos, y no todos cuelgan del
negocio igual:

- **`DiscountRule`** lleva la columna `negocioId` encima (nullable — ADR 0082).
- **`ProductoTienda`** y **`MovimientoStock`** *no* tienen columna de negocio: cuelgan de `Tienda`.
  En `src/lib/reports/cpp-report.ts` no hay hoy ni siquiera un intento de derivar el negocio; el
  `where` es `{ tiendaId }` a secas.

Ese camino de relaciones ya está escrito una sola vez en el proyecto, en `TENANT_RELATION_PATH`
(`src/constants/tenantScope.ts`), cuyo docstring es explícito: es *«la ÚNICA definición de ese camino
en el proyecto: ninguna ruta corregida escribe `tienda: { negocioId }` a mano»*. Los dos modelos que
necesita CPP ya están en el mapa (`productoTienda: ["tienda"]`, `movimientoStock: ["tienda"]`), y
`withTenantScope` es puro y ya tiene tests propios.

Hay además un detalle que separa a `migrarDatosHistoricosCPP` de las otras cuatro funciones: **es la
única que escribe.** Con `dryRun: false` recorre las filas que devolvió su `findMany` y hace
`prisma.movimientoStock.update({ where: { id } })` sobre cada una. No es una fuga de lectura: es una
escritura cruzada, y la más cara de deshacer de todo el feature.

Y una restricción de bundle que condiciona la forma de importar: `src/store/useCartTotals.ts` es un
módulo `"use client"` y hace un **import de valor** de la barrica `@/lib/discounts`, que es un módulo
de servidor (importa el singleton de Prisma).

## Decisión

**1. Los `where` de CPP se construyen con `withTenantScope`, con los modelos que el mapa ya
conoce.** Nada de `tienda: { negocioId }` escrito a mano:

```ts
withTenantScope("productoTienda", { tiendaId, existencia: { gt: 0 } }, negocioId)
// -> { tiendaId, existencia: { gt: 0 }, tienda: { negocioId } }

withTenantScope("movimientoStock", { tiendaId, tipo: { in: … }, costoUnitario: null }, negocioId)
// -> { tiendaId, tipo: { in: … }, costoUnitario: null, tienda: { negocioId } }
```

**2. `DiscountRule` NO se añade a `TENANT_RELATION_PATH`, y su cláusula es la columna propia**
(`{ isActive: true, negocioId }`). Dos motivos:

- El mapa existe para *nombrar el camino de relaciones* de un modelo que no tiene la columna.
  `DiscountRule` la tiene: no hay camino que nombrar.
- Añadir una clave al mapa **rompe la compilación al otro lado de la frontera de escritura del
  pipeline**. `MODEL_SCALAR_KEYS`, en `src/__tests__/fixtures/threeTenants.ts`, es
  `satisfies Record<ITenantScopedModel, …>` — exhaustivo a propósito. El mapa lo edita el
  `implementer` (`src/constants/`) y el fixture el `dev-tester` (`src/__tests__/`), que trabajan en
  paralelo y sin verse: una clave nueva deja el árbol del otro sin compilar. `tenantModel` del
  inventario de rutas (`src/schemas/routeGuards.ts`) también deriva su enum de ese mapa.

Por lo mismo, **F-022 no toca `src/constants/routeGuards/routeGuards.json`**. No añade ni corrige
ninguna guarda de ruta: los `motivo` de las entradas de `discounts/*` y `cpp/*` describen el hallazgo
de F-021 tal como era entonces, y siguen siendo ciertos como historia. `DESPROTEGIDAS_ABIERTAS` se
queda en 0 y el trinquete de ADR 0081 no se mueve.

**3. La escritura de `migrarDatosHistoricosCPP` lleva su propia cláusula de tenant.** Pasa de
`update` a `updateMany` con el `where` acotado:

```ts
withTenantScope("movimientoStock", { id: movimiento.id }, negocioId)
```

`update` exige un `where` único y no admite filtros de relación, así que no puede llevar la
cláusula; `updateMany` sí. El contador se mantiene idéntico: `count === 1` cuenta como procesado y
cualquier otro valor cuenta como error, que es lo que hoy hace el `catch`.

**4. `src/store/useCartTotals.ts` pasa a importar `applyDiscounts` de `@/lib/discounts/engine`**, no
de la barrica. `applyDiscountsForSale` necesita `withTenantScope` para acotar su lectura de
`ProductoTienda`, y ese símbolo arrastra `next/server`: no debe entrar en el grafo del POS por una
barrica de servidor. El motor es el módulo que la barrica ya reexporta *precisamente* para eso —su
propio comentario dice que el POS lo ejecuta en el navegador—, y los otros dos consumidores de
cliente (`CartSummaryFooter.tsx`, `DiscountField.tsx`) solo usan `import type`, que se borra al
compilar.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Escribir `tienda: { negocioId }` a mano en `cpp-report.ts` | Convierte el camino de relaciones en una paráfrasis repetida: E-014 y E-039 en un solo gesto. El mapa existe para que haya una sola definición. |
| Añadir `discountRule: []` a `TENANT_RELATION_PATH` por uniformidad | Rompe `MODEL_SCALAR_KEYS` en el árbol del `dev-tester`, que se escribe en paralelo. Y no aporta: el modelo no tiene camino que recorrer. |
| Dejar la escritura con `update` y confiar en que el `findMany` ya filtró | Es la confianza que este feature existe para quitar. La lectura y la escritura están separadas por un bucle; el `where` del `update` es el último sitio donde el filtro cuesta una línea. |
| Cargar los ids y hacer un solo `updateMany` con `id: { in: ids }` | Cambia la forma del reporte: `detalles` y `errores` se construyen hoy por movimiento. El criterio 4 y el 6 piden que nada observable cambie. |
| Dejar `useCartTotals` como está | Mete `next/server` y `next-auth` en el grafo del POS a través de una barrica de servidor. Una línea evita arrastrar el problema. |

## Consecuencias

**A favor:**
- El camino `MovimientoStock → Tienda → negocioId` sigue definido en un único sitio; si algún día
  cambia el schema, cambia ahí y CPP lo hereda.
- Los `where` quedan como objetos planos producidos por funciones puras: el `dev-tester` los puede
  evaluar con el `matchesWhere` y el fixture de tres negocios que F-021 ya dejó hechos (ADR 0080),
  sin base de datos.
- La escritura queda acotada por el mismo mecanismo que la lectura, no por su proximidad en el
  código.

**En contra / coste asumido:**
- `updateMany` devuelve `{ count }` en vez de la fila. Se asume: el código solo contaba.
- Dos mecanismos de cláusula conviviendo (columna propia para `DiscountRule`, relación para los dos
  de CPP). Es la realidad del schema, no una inconsistencia del código, y este ADR es donde queda
  escrita.
- El cambio de import de `useCartTotals` toca un archivo de cliente en un feature que no quería
  tocar ninguno. Es una línea, mecánica, y el criterio 6 la recorre en el navegador.

**Impacto en seguridad y escalabilidad:**
- La única escritura cruzada del feature deja de depender de que la lectura anterior estuviera bien
  acotada.
- El filtro de CPP añade un `JOIN` con `Tienda` a dos consultas de reportes. Es una relación por
  clave primaria y las consultas ya filtran por `tiendaId` (indexado): el conjunto de partida no
  cambia de tamaño.
- `migrarDatosHistoricosCPP` sigue recorriendo su `findMany` sin paginar, exactamente como hoy.
  F-022 no arregla eso; queda anotado como límite conocido, no como algo que este feature resuelva.
