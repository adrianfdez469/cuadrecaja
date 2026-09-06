# ADR 0083: Las cinco funciones reciben un objeto de params que contiene `ITenantScope`, y `fetchDiscountRulesForTienda` conserva `tiendaId` sin usarlo

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-022

## Contexto

Las cinco funciones que migra F-022 tienen hoy dos formas distintas de recibir sus argumentos:

```ts
fetchDiscountRulesForTienda(tiendaId: string)
applyDiscountsForSale(params: { tiendaId, products, discountCodes? })
analizarCPPTienda(tiendaId: string)
detectarDesviacionesCPP(tiendaId: string, umbralPorcentaje: number = 10)
migrarDatosHistoricosCPP(tiendaId: string, dryRun: boolean = true)
```

Hay que meter un `negocioId` en las cinco. Dos detalles condicionan cómo:

- **`negocioId` y `tiendaId` son los dos un `string` con forma de UUID.** Pasados por posición,
  `f(negocioId, tiendaId)` compila igual de bien que `f(tiendaId, negocioId)`: el compilador no
  distingue el intercambio, y el resultado de intercambiarlos es una consulta que no filtra por
  nada real. En un feature cuyo objetivo entero es el filtro de tenant, ese es el error que no
  puede quedar disponible.
- **Todos los llamadores ya tienen el par junto y validado.** `assertTiendaTenant` devuelve
  `ITenantScope = { negocioId: string; tiendaId: string }` (`src/lib/tenantScope.ts`), y las siete
  entradas HTTP que llaman a estas funciones pasan por él antes.

Queda además una pregunta que el spec deja abierta a propósito («repetir con `tiendaId`
vacío/`undefined` **si la firma nueva lo admite**»): una vez que `negocioId` llega por parámetro,
`fetchDiscountRulesForTienda` **no tiene ningún uso para `tiendaId`**. `DiscountRule` no tiene
columna de tienda; las reglas son del negocio. El `tiendaId` solo servía para derivar el negocio, que
es justo lo que el criterio 1 manda quitar.

## Decisión

**Las cinco funciones toman un único objeto de params, y ese objeto contiene los dos campos de
`ITenantScope`**, importado como tipo (`import type`) desde `@/lib/tenantScope`:

```ts
fetchDiscountRulesForTienda(params: ITenantScope)
applyDiscountsForSale(params: ITenantScope & { products; discountCodes? })
analizarCPPTienda(params: ITenantScope)
detectarDesviacionesCPP(params: ITenantScope & { umbralPorcentaje?: number })
migrarDatosHistoricosCPP(params: ITenantScope & { dryRun?: boolean })
```

Así el llamador escribe `fn(scope)` o `fn({ ...scope, ...resto })` con el objeto que ya tiene en la
mano, y el intercambio posicional deja de existir como error posible.

**`fetchDiscountRulesForTienda` conserva `tiendaId` en su firma aunque no entre en la consulta**, y
lo documenta en su docstring. Dos razones, y la primera es la que manda:

1. El criterio 2 se ejecuta *literalmente* llamando a esta función «con un `tiendaId` inexistente…
   verificado ejecutando con un uuid inventado». Un criterio no se reescribe (regla del backlog) y
   se ejecuta con su redacción congelada (E-018): si el parámetro desaparece, el criterio deja de
   ser ejecutable tal como está escrito.
2. Es el contexto de la llamada y el que da nombre a la función. Todos los llamadores lo tienen; no
   cuesta nada pasarlo.

Los argumentos opcionales conservan **exactamente** sus valores por defecto actuales:
`umbralPorcentaje = 10` y `dryRun = true`. Ausente sigue significando lo mismo que hoy.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Añadir `negocioId` como segundo parámetro posicional | Dos UUID seguidos e intercambiables sin error de compilación, en las funciones cuyo único propósito en este feature es filtrar por el segundo. |
| Dejar `applyDiscountsForSale` con objeto y las de CPP con posicionales | Dos convenciones para el mismo argumento en el mismo feature. Cinco firmas que se leen igual son cinco firmas que se revisan igual. |
| Quitar `tiendaId` de `fetchDiscountRulesForTienda` por no usarse | Deja el criterio 2 sin forma de ejecutarse tal como está escrito, y obliga a renombrar la función para que el nombre no mienta. Coste alto, beneficio cosmético. |
| Declarar los params como schema Zod en `src/schemas/` | No son entrada externa: vienen de `assertTiendaTenant`, ya validado. Añadir schemas de valor solo para tipar params internos es la vía de los ciclos de módulo de E-028. Se sigue el precedente del propio `src/lib/tenantScope.ts`, que declara `ITenantScope`, `ITenantScopeResult` e `ITenantAxisResult` como tipos TS planos. |
| Un objeto `scope: ITenantScope` anidado dentro de los params | Una indirección más para escribir `{ scope, products }` en vez de `{ ...scope, products }`. El aplanado permite pasar `scope` tal cual donde no hay más argumentos. |

## Consecuencias

**A favor:**
- Un `negocioId` omitido es un error de compilación en el sitio de la llamada, que es lo que pide el
  criterio 1 («`npx tsc --noEmit` debe fallar»). Una propiedad obligatoria ausente en un literal de
  objeto es error incluso con `strict: false`, a diferencia del estrechamiento por booleano (E-036).
- `import type` no añade nada al grafo de runtime: `@/lib/tenantScope` importa `next/server` y no
  debe acabar en el bundle del POS por esta vía.
- Los siete sitios de llamada se migran escribiendo `scope` o `{ ...scope, … }`: el valor no se
  busca en ningún sitio nuevo.

**En contra / coste asumido:**
- `fetchDiscountRulesForTienda` recibe un parámetro que no usa. Es deliberado y está escrito aquí y
  en su docstring, para que no se lea como resto de una limpieza a medias ni se «arregle» después.
- Cambian las cinco firmas a la vez: es un cambio atómico, no incremental. Con siete sitios de
  llamada, `tsc` los enumera todos.

**Impacto en seguridad y escalabilidad:**
- Elimina la clase de error «los dos UUID intercambiados», que produce un filtro que no aísla nada y
  que ningún tipo detecta.
- Ninguna consulta nueva: el `negocioId` viaja como argumento y `fetchDiscountRulesForTienda` deja
  de leer `Tienda`, así que la migración quita **una** consulta por preview y por venta.
