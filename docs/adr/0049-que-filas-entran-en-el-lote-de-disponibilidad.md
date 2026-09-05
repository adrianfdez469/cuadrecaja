# ADR 0049: Qué filas entran en el lote de disponibilidad

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-007

## Contexto

El índice `idx_disp_divergente` cubre **toda** fila de `ProductoTienda` cuyo enum calculado difiere
de `dispPublicada`, sin más condición. Eso incluye filas que queandabuscando (QAB) no conoce ni
puede conocer: productos no publicados, productos de una tienda que nunca se publicó, filas borradas
en blando, y filas cuyo evento `PRODUCT` sigue esperando en el outbox.

Mandar esas filas no es gratis, y la razón no es el ancho de banda. Leyendo el endpoint del otro
lado (`POST /api/internal/sync/availability`) se ven dos comportamientos que deciden el asunto:

1. **`confirmed` se rellena para todo item cuya *tienda* resuelve**, exista o no el producto. El
   servidor busca las tiendas del negocio por `externalId`; si la tienda no está, el item se salta y
   no se confirma; si está, el item se confirma **aunque su `StoreProduct` no exista**, porque el
   `updateMany` correspondiente simplemente no encuentra fila que tocar.
2. **`StoreProduct.availability` tiene `@default(AVAILABLE)`.** Una fila creada más tarde por un
   evento `PRODUCT` —que no lleva disponibilidad en su `payload`— nace `AVAILABLE`.

Combinadas producen una divergencia **permanente y silenciosa**:

```
t0  producto se publica; su evento PRODUCT queda pendiente en el outbox.
t1  la fase de disponibilidad manda OUT_OF_STOCK; la tienda existe → confirmado
    → dispPublicada = 'OUT_OF_STOCK'. Del otro lado no hay StoreProduct: no se aplica nada.
t2  el drenaje entrega el evento PRODUCT; nace el StoreProduct con availability = AVAILABLE.
    Escaparate: «disponible». POS: dispPublicada = 'OUT_OF_STOCK' = enum calculado → NO diverge.
    Nadie lo vuelve a mandar.
```

Queda mal hasta que la existencia vuelva a cambiar, o hasta que la reconciliación de F-008 —que hoy
no existe— ponga `dispPublicada` a `NULL`. Y el caso no es rebuscado: publicar un producto que
justo está agotado es un lunes cualquiera.

El extremo contrario también tiene coste: mandar filas de una **tienda** que QAB no conoce las deja
sin confirmar corrida tras corrida. No se pierde nada, pero se reenvía lo mismo indefinidamente.

## Decisión

La consulta de divergencia añade cuatro condiciones al predicado del índice. Todas son
restricciones adicionales, así que el `WHERE` sigue implicando el predicado parcial y el índice
sigue siendo aprovechable (ADR 0048):

| Condición | Por qué |
|---|---|
| `t."negocioId" = ANY($negociosElegibles)` | Aislamiento multi-tenant y elegibilidad. La lista la calcula el orquestador del cron con `qabToken: { not: null }, tiendaOnlineHabilitada: true`; F-007 no la recalcula |
| `t."publicarEnTienda" = true` | Una tienda no publicada no existe del otro lado: sus items nunca se confirmarían y se reenviarían en cada corrida |
| `p."publicarEnTienda" = true` | El opt-in del producto. Sin él no hay `StoreProduct`, y confirmar sin que exista es lo que produce la divergencia permanente de arriba |
| `pt."deletedAt" IS NULL` y `p."deletedAt" IS NULL` | Un borrado en blando no tiene disponibilidad que publicar |

Y una quinta, que no es un filtro de publicación sino de **orden**:

> Una fila cuyo evento `PRODUCT` sigue pendiente y reintentable en el outbox
> (`entidad = 'PRODUCT' AND entidadId = pt.id AND procesadoAt IS NULL AND intentos < QAB_OUTBOX_MAX_ATTEMPTS`)
> **no manda su disponibilidad todavía**.

Se resuelve con **una sola consulta más** por corrida —no con un `NOT EXISTS` por fila—, sobre el
índice `@@index([entidad, entidadId])` que `OutboxEvento` ya tiene, y el descarte se aplica en
TypeScript. El mismo patrón que `readQabProductoTiendaSyncStates` ya usa para la pantalla de
publicación.

`intentos < QAB_OUTBOX_MAX_ATTEMPTS` es deliberado, y es la parte que se escapa fácil: un evento
**agotado** nunca llega a tener `procesadoAt`, así que sin ese recorte bloquearía la disponibilidad
de su fila **para siempre**. Un evento agotado no va a crear ningún `StoreProduct`, de modo que la
carrera que el descarte evita ya no puede ocurrir y la fila vuelve a entrar con normalidad.

El orden de las fases del cron es la otra mitad de la misma decisión: **el drenaje va antes que la
disponibilidad, en la misma corrida**. Con eso, el caso normal —publicar un producto y que su enum
salga en la misma corrida— no pierde ni un ciclo: el evento se entrega en la fase 1 y su
disponibilidad sale en la fase 3.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Mandar toda fila divergente, sin ningún filtro | Produce la divergencia permanente de arriba, publica en el escaparate el estado de productos que el comerciante no quiso publicar y hace que la primera corrida de cada negocio mande el inventario entero |
| Filtrar solo por publicación, sin mirar el outbox | Reduce el problema pero no lo cierra: con el outbox atrasado, un producto recién publicado sigue confirmándose antes de que su `StoreProduct` exista |
| Un `NOT EXISTS` correlacionado dentro de la propia consulta de divergencia | Mete una subconsulta por fila candidata sobre una tabla que crece sin tope (la purga de F-019 la acota, no la fija). Una consulta suelta con un `in` de ids hace el mismo trabajo con un solo viaje |
| Descartar por `procesadoAt IS NULL` a secas | Un evento agotado (`intentos >= QAB_OUTBOX_MAX_ATTEMPTS`) nunca se procesa: bloquearía la disponibilidad de esa fila para siempre. Es [E-013] con otro sujeto — una condición que en la práctica nunca cambia de valor |
| Dejar la divergencia permanente para que la arregle la reconciliación de F-008 | F-008 no está construido, y aunque lo estuviera, apoyar la corrección de un caso cotidiano en una auditoría diaria convierte una alerta excepcional en el camino normal |
| Añadir `precio`/`monedaPrecioCode` no nulos, como hace el SQL de reconciliación | Ahí evitan una diferencia permanente en un hash. Aquí solo harían que una fila que hoy se reenvía sin confirmarse se dejara de leer, y a cambio hay que replicar la resolución de moneda de F-006 en un segundo sitio. Ver «Consecuencias» |

## Consecuencias

**A favor:**

- Lo que sale por el cable es lo que el otro lado puede aplicar: el escaparate no acaba mostrando
  «disponible» sobre un producto agotado por una carrera entre dos fases.
- La primera corrida de un negocio manda su catálogo **publicado**, no su inventario entero.
- Una fila que no cumple las condiciones no se pierde: sigue divergente y entra en cuanto las
  cumpla. Publicar un producto lo mete en el lote sin que nadie reencole nada.

**En contra / coste asumido:**

- Las filas no publicadas y las de negocios no elegibles son divergentes **para siempre** y viven en
  el índice parcial. Es inherente al criterio 9 (un negocio sin tienda online no se toca) y lo
  documenta el ADR 0048.
- Una consulta más por corrida, y una lista de hasta `QAB_AVAILABILITY_MAX_ROWS_PER_RUN` ids en su
  `in`.
- Una fila publicada cuyo evento `PRODUCT` nunca produjo un `payload` válido (moneda irresoluble, por
  ejemplo) se lee y se manda en cada corrida sin confirmarse nunca, porque no se filtra por
  `precio`/`monedaPrecioCode`. El trabajo desperdiciado está acotado por el tope de la corrida, y la
  alternativa era duplicar la resolución de moneda de F-006 aquí.
- El descarte por outbox mira `OutboxEvento`, así que la fase de disponibilidad deja de ser
  independiente del estado del outbox. Es una dependencia de lectura, no de escritura: la
  disponibilidad sigue sin usar el outbox como cola (regla de negocio 1 del spec).

**Impacto en seguridad y escalabilidad:**

- La condición de `negocioId` es la primera del filtro y entra por el `JOIN` con `Tienda`, que es la
  única ruta que `ProductoTienda` tiene hasta su tenant. Ninguna fila de otro negocio llega siquiera
  a leerse, mucho menos a un lote (criterio 8).
- La consulta del outbox lleva también `negocioId: { in: negociosElegibles }`, aunque `entidadId` sea
  un UUID único: el filtro por tenant no se omite porque «no haga falta».
- El coste añadido es una consulta indexada por corrida, no por fila ni por negocio.

[E-013]: ../../.agents/errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md
