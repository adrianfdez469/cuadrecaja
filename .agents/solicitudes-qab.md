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
| S-002 | Qué hace el SQL espejo con un producto borrado en blando | F-008 | contrato v7 · 2026-09-01 |

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


---

### S-002 · El SQL espejo no dice qué hacer con un borrado en blando

**El problema.** El SQL espejo de reconciliación que publica el contrato (§ ⑤) selecciona de
`ProductoTienda` filtrando por tienda, por `publicarEnTienda`, por `precio` no nulo y por
`monedaPrecioCode` no nulo. No filtra nada más, porque no puede: el schema de cuadrecaja es de
cuadrecaja y vosotros no lo conocéis.

Pero cuadrecaja **no borra productos, los marca**: `Producto` y `ProductoTienda` tienen `deletedAt`
y el borrado es blando. Una fila borrada de esa forma sigue existiendo, sigue teniendo precio y
moneda, y sigue colgando de un producto con `publicarEnTienda = true` — así que **el espejo la
cuenta**. Del vuestro, en cambio, ese producto ya no está: lo despublicamos y os llegó su baja.

Consecuencia: el hash diverge y **no vuelve a converger nunca**. Y esa divergencia es exactamente
la señal con la que F-008 concluye que la sincronización se rompió, así que dispara la
recuperación (poner `dispPublicada = NULL` en todas las filas de la tienda) y la alerta, una y
otra vez, sobre unos datos que en realidad están bien.

**Lo que preguntamos.** No es una petición de API: es una aclaración del contrato, y creemos que
la respuesta correcta es la primera.

- ¿Confirmáis que el espejo debe excluir las filas dadas de baja, y que la exclusión es
  responsabilidad del lado que la tiene (nosotros añadimos `AND p."deletedAt" IS NULL AND
  pt."deletedAt" IS NULL`)? Si es así, nos vale con que quede escrito en el § ⑤ como nota, para
  que el siguiente que lo lea no tenga que deducirlo.
- ¿O hay algún caso en el que un producto retirado deba seguir contando por vuestro lado?

**Por qué no lo decidimos solos.** Podríamos añadir el filtro y seguir. Pero el hash es un acuerdo
entre dos bases de datos de dos organizaciones: si cada lado ajusta el espejo por su cuenta para
que le cuadre, deja de detectar lo que existe para detectar. Preferimos que la regla esté escrita
en el documento vinculante.

**Mientras tanto** no bloquea nada inmediato. F-001 solo comprueba que el SQL corre contra el
schema real, y ahí el soft delete no interviene. Quien tiene que estar resuelto antes es **F-008**,
que es donde el hash pasa a ser una decisión operativa.
