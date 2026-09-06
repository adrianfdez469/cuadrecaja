# ADR 0082: `negocioId = NULL` en `DiscountRule` es una fila huérfana, y el filtro es igualdad estricta

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-022

## Contexto

F-022 convierte el `where` de `fetchDiscountRulesForTienda` en un filtro explícito por `negocioId`.
La columna, sin embargo, **admite nulos**:

```prisma
// prisma/schema.prisma
negocio   Negocio? @relation(fields: [negocioId], references: [id])
negocioId String?
```

En Postgres —y por tanto en Prisma— `WHERE negocioId = 'N_A'` **no devuelve las filas con NULL**.
Así que decidir el `where` es decidir qué significa un `DiscountRule` sin negocio: si es una *regla
global de plataforma* que hay que seguir aplicando, o una *fila huérfana* que no pertenece a nadie.

La restricción explícita del humano al abrir el feature es **«sin romper nada»** (criterios 4 y 6
del spec), de modo que la decisión no puede tomarse solo por elegancia.

Cuatro hechos medidos antes de decidir:

1. **La única vía de creación siempre rellena la columna.** `src/app/api/discounts/route.ts:95`
   construye el `data` con el `negocioId` de la sesión; no hay ninguna otra escritura de
   `DiscountRule` en `src/` (verificado por barrido el 2026-09-06: los demás usos son `findMany`,
   `findFirst`, `update`, `delete` y el `deleteMany` de `deleteNegocioCompleto`).
2. **La base de desarrollo tiene 0 reglas**, ninguna con NULL. Producción puede tener filas
   heredadas: el schema lo permite y nadie puede afirmar lo contrario desde aquí.
3. **Hoy una fila con NULL ya es invisible en toda petición que funciona.** Cuando la tienda existe
   —que, tras F-021, es el caso de las cinco rutas llamadoras, porque `assertTiendaTenant` lo
   garantiza antes de la llamada— el código actual acaba en
   `where: { isActive: true, negocioId: <el del negocio> }`, que excluye los NULL exactamente igual
   que el filtro nuevo.
4. **Solo son visibles por la vía rota.** Con un `tiendaId` que no existe, el spread condicional
   desaparece y el `where` queda en `{ isActive: true }`: ahí sí salen los NULL… junto a las reglas
   activas de todos los demás negocios. Es decir, el único camino que hoy aplica una regla NULL es
   el mismo que filtra datos entre tenants.

## Decisión

**`negocioId = NULL` significa fila huérfana: no pertenece a ningún negocio y no se aplica a
ninguno.** El filtro es igualdad estricta:

```ts
{ isActive: true, negocioId }
```

Y, como corolario operativo que el contrato hace explícito: **ninguna consulta de descuentos escribe
`OR: [{ negocioId }, { negocioId: null }]`**, ni ninguna otra forma de readmitir el nulo.

No se cambia el schema en este feature: la columna sigue siendo `String?`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Tratar el NULL como **regla global de plataforma** (`OR` con `negocioId: null`) | Es la que **sí** rompe algo. Hoy una regla NULL no se aplica en ninguna venta que funcione (hecho 3); con el `OR` empezaría a aplicarse en **todos** los negocios a la vez. Cambiar precios de venta en producción es justo lo que el criterio 4 prohíbe. Y crea a propósito la única entidad transversal a tenants de un sistema cuyo fallo más grave es la fuga entre negocios. |
| Migrar la columna a `NOT NULL` con backfill | Es la solución de fondo y no cabe aquí: exige decidir a qué negocio se adjudica cada fila heredada, y una migración que borra o reasigna filas de producción no es reversible. F-022 es defensa en profundidad sobre `src/lib/`, sin cambios de schema. Queda como trabajo futuro, y el `?` no estorba mientras el filtro sea estricto. |
| Lanzar si aparece una fila con NULL | Convierte un dato heredado inofensivo en un 500 en el POS. Además es una aserción sobre datos que esta capa no puede reparar. Contradice ADR 0084. |
| Dejar el spread condicional y añadir el `negocioId` solo «cuando venga» | Es literalmente el bug: un parámetro opcional que desaparece del `where` cuando falta es lo mismo que no tener filtro. El criterio 1 exige parámetro **obligatorio**. |

## Consecuencias

**A favor:**
- El comportamiento observable no cambia en ninguna petición que hoy funcione: para toda tienda
  existente, el conjunto de reglas devuelto es exactamente el de antes (hechos 1–3). El único
  camino cuyo resultado cambia es el que devolvía reglas de otros negocios.
- El significado de la columna queda escrito una sola vez, aquí, y el contrato lo repite en la
  firma. Ni `implementer` ni `dev-tester` tienen que interpretarlo por su cuenta — que es
  exactamente el fallo de E-030.
- Reversible: si algún día aparece una necesidad real de reglas de plataforma, se diseñan como tal
  (con su propia columna o su propio modelo), no reciclando un nulo heredado.

**En contra / coste asumido:**
- Si en producción existiera una regla activa con `negocioId = NULL`, deja de estar disponible…
  salvo que ya lo estaba: solo era alcanzable por la vía rota. Se asume conscientemente.
- La columna sigue admitiendo nulos, así que nada impide que una escritura futura vuelva a crearlos.
  Lo que hay contra eso es esta decisión escrita y el test del criterio 5.

**Impacto en seguridad y escalabilidad:**
- Cierra el caso «tienda desconocida ⇒ consulta sin filtro», que devolvía las reglas activas de toda
  la plataforma.
- El índice existente `@@index([isActive])` sigue sirviendo; el filtro añade una igualdad más sobre
  una columna de cardinalidad alta, así que el plan no empeora. La tabla es pequeña por naturaleza
  (reglas de descuento por negocio), no crece con las ventas.

---

## Adenda 2026-09-06 — la premisa, verificada contra producción

Este ADR se apoyaba en una premisa que el código no podía demostrar por sí solo, y así quedó
escrito: en desarrollo hay cero `DiscountRule`, pero nadie podía afirmar desde aquí que producción
no tuviera filas heredadas con `negocioId = NULL`. Si las hubiera, la igualdad estricta las dejaría
fuera y el «sin romper nada» se rompería el día del despliegue, no en ningún test.

El humano ejecutó la consulta contra la base real:

```sql
SELECT count(*) FROM "DiscountRule" WHERE "negocioId" IS NULL AND "isActive" = true;
-- 0
```

**Cero.** La premisa se sostiene fuera de desarrollo: no hay ninguna regla legítima a la que la
igualdad estricta deje sin aplicar. La decisión de este ADR queda verificada, no solo argumentada.

Lo que no cambia: la prohibición de ensanchar el filtro con `OR: [{ negocioId }, { negocioId: null }]`
sigue en pie, y por el mismo motivo de siempre — haría que una regla huérfana, si algún día
apareciera, empezara a descontar en **todos** los negocios a la vez.

