# Solicitudes abiertas al equipo de queandabuscando

Cosas que el contrato exige o presupone y que su API no ofrece hoy. Cada una bloquea features
concretos de [`features.json`](features.json). Se registran aquí para que no se pierdan entre
conversaciones y para que el bloqueo tenga una causa nombrada.

Al resolverse: anotar la versión del contrato que la incorpora, desbloquear los features
afectados y borrar la entrada de la tabla de abiertas.

## Abiertas

| # | Qué falta | Bloquea | Desde |
|---|-----------|---------|-------|
| S-001 | Releer un pedido concreto sin depender del cursor | F-013, F-015, F-017 | contrato v7 · 2026-09-01 |

---

### S-001 · No hay forma de releer un pedido concreto

**El problema.** El único endpoint de lectura de pedidos es
`GET /api/internal/orders?since=&limit=`, que filtra `id > since`. Pero la resolución de una
propuesta ocurre siempre sobre un pedido que el POS **ya pulleó**, cuyo `id` es por tanto **menor
que el cursor**. El pull incremental nunca lo devuelve.

Consecuencia directa: **el encargado no se entera nunca de que el comprador aceptó o rechazó.**
No es un caso raro — con el envío cotizado de la v6, cotizar *es* proponer, así que el camino
pasa por ahí en cada pedido a domicilio de una tienda en `QUOTED_PER_ORDER`.

**Vosotros ya lo detectasteis.** El contrato lo dice en § «El timbre del canal `negocio:`»:

> Al oír el timbre, el lector hace DOS lecturas, no una: su pull incremental de siempre
> (`since=<cursor>`) **y** una relectura de los pedidos que tenga en `AWAITING_CUSTOMER`.

Lo que falta es el **cómo**: no hay parámetro para esa segunda lectura. Y el problema no es del
timbre — existe igual con el cron solo, porque el filtro del cursor es el mismo.

**Lo que pedimos.** Cualquiera de las dos, la que os encaje mejor:

- `GET /api/internal/orders?ids=42,57,91` — relectura explícita de un conjunto conocido.
- `GET /api/internal/orders?status=AWAITING_CUSTOMER` — todos los que estén en ese estado,
  ignorando el cursor.

Preferimos la segunda: el POS no tiene por qué llevar la lista, y es la pregunta que de verdad
quiere hacer. Con cualquiera de las dos, `nextCursor` no debería moverse: es una lectura lateral,
no un avance.

**El apaño que existe, y por qué no lo tomamos.** Se puede emular con
`?since=<id-1>&limit=1` por cada pedido en `AWAITING_CUSTOMER`. Funciona, pero es una llamada por
pedido en cada ciclo, abusa de un parámetro para algo que no es, y se lleva mal con la regla de un
solo pull en vuelo por negocio. Preferimos esperar a que exista la forma correcta antes que
construir sobre el apaño y tener que quitarlo después.

**Mientras tanto** F-013, F-015 y F-017 están en `status: "blocked"`. No hay prisa por nuestra
parte más allá de que la renegociación entera depende de esto.
