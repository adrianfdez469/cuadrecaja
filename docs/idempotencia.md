# Idempotencia y reintentos

## La regla

`src/lib/axiosClient.ts` reintenta hasta 2 veces ante `ECONNABORTED` (timeout de
30 s) y `ERR_NETWORK`. Reintentar es seguro **solo si repetir la petición no
cambia el resultado**, así que la política es:

- **GET / HEAD / OPTIONS / PUT / DELETE** → se reintentan siempre.
- **POST / PATCH** → se reintentan **solo** si llevan el header
  `Idempotency-Key`, o sea si el endpoint sabe reconocer el reenvío.

Por qué importa: cuando axios aborta por timeout, **el servidor no cancela
nada**. El handler original sigue vivo y termina commiteando igual, así que el
reintento se solapa con una ejecución todavía en curso. Un POST reintentado a
ciegas duplica datos (fue el bug de movimientos duplicados en redes lentas).

## Cómo volver reintentable un POST

Hay **una sola tabla de idempotencia para toda la app** (`IdempotencyKey`), no
una por dominio. Los helpers están en `src/lib/idempotency.ts` y el patrón es
claim primero, store al final, ambos dentro de la transacción del endpoint:

```ts
const claim = { key, scopeId: user.negocio.id, endpoint: "POST /api/movimiento" };

// Camino feliz: ya se procesó, se responde lo mismo sin rehacer el trabajo.
const replayed = await findIdempotentResponse<Payload>(claim);
if (replayed) return NextResponse.json(replayed, { status: 200 });

const response = await prisma.$transaction(async (tx) => {
  await claimIdempotencyKey(tx, claim);
  const result = await elTrabajo(tx);
  await storeIdempotentResponse(tx, key, result);
  return result;
});
```

Por qué la clave se reserva **dentro** de la transacción: si el trabajo falla, el
rollback también la libera y el usuario puede reintentar con la misma. Una clave
escrita en una transacción aparte sobreviviría al fallo y haría que el siguiente
intento responda "ya se hizo" sobre algo que nunca ocurrió — peor que el
duplicado que se quería evitar.

Tres detalles que hacen falta:

- **`scopeId` y `endpoint` forman parte del match.** Una clave repetida contra
  otro negocio u otra ruta se trata como desconocida, nunca se responde con
  datos de otro tenant.
- **La respuesta se guarda y se reproduce tal cual.** Un reenvío recibe lo mismo
  que la ejecución original (por ejemplo las advertencias de caja), no un payload
  vacío.
- **Un reenvío devuelve éxito, no error**: la operación sí se aplicó.

Cuando el `DuplicateRequestError` salta, la respuesta ya está almacenada: el
índice único retiene a la segunda petición hasta que la primera commitea, así
que solo llega ahí después de que aquella terminó.

Para cubrir además el reintento **manual** del usuario tras un error, la clave
tiene que sobrevivir a la petición — guardarla en un ref del componente y
renovarla solo al éxito (`idempotencyKeyRef` en los diálogos de movimiento). El
header por sí solo cubre únicamente el reintento automático de axios.

La tabla crece una fila por operación protegida, así que se limpia sola: el cron
`/api/crons/purge-expired-idempotency-keys` (diario, 04:00 UTC, declarado en
`vercel.json`) borra las claves de más de `IDEMPOTENCY_KEY_TTL_HOURS` (24 h).
Borrarlas es seguro — cualquier petición que aún pudiera reproducirlas se dio por
vencida hace rato, y una petición nueva trae una clave nueva.

`Venta.syncId` es un mecanismo equivalente anterior a este helper, y sigue en uso
en `/api/venta`.

### Cuando hay una transición de estado, no hace falta clave

Si la operación tiene una precondición de estado natural (`PENDIENTE` →
`RECHAZADO`), el compare-and-set es más simple y no depende de que el cliente
mande nada: se actualiza con la precondición en el `where` y se comprueba el
`count`.

```ts
const claimed = await tx.movimientoStock.updateMany({
  where: { id: movimientoId, state: "PENDIENTE" },
  data: { state: "RECHAZADO" },
});
if (claimed.count === 0) return; // otra ejecución ya lo reclamó
```

Así está resuelto `POST /api/movimiento/rechazo`, y protege también contra el
doble click, no solo contra el reintento de red.

### Excepción: trabajo no atómico

`POST /api/movimiento/import` procesa en chunks de 50, cada uno con su propia
transacción, y admite éxito parcial a propósito. Como no hay una única
transacción del trabajo, la clave se reserva antes, en su propia escritura, y
**no se libera si la importación falla**: liberarla dejaría reimportar los chunks
que sí entraron. Ante un fallo el usuario relanza la importación y el cliente
genera una clave nueva — una decisión deliberada, no un reintento ciego.

### Cobertura de las operaciones de movimientos

Los diez handlers que crean `MovimientoStock` están protegidos:

| Handler | Mecanismo |
|---|---|
| `POST /api/movimiento` | clave de idempotencia |
| `POST /api/movimiento/import` | clave de idempotencia (reservada aparte, ver arriba) |
| `POST /api/movimiento/rechazo` | compare-and-set sobre `state` |
| `POST /api/venta/[tiendaId]/devolucion/[ventaId]` | clave de idempotencia |
| `POST /api/venta/[tiendaId]/[cierreId]`, `POST /api/app/venta/[...]` | `Venta.syncId` |
| Los tres `DELETE` de venta y `DELETE /api/productos/[id]` | bloquear y re-verificar (ver abajo) |

## El patrón para operaciones que revierten efectos

Devolver stock, revertir pagos o cerrar un período **no son idempotentes**:
repetirlos aplica el efecto dos veces. La protección correcta es siempre la
misma — **bloquear la fila y re-verificar la precondición como primera operación
de la transacción**:

```ts
await prisma.$transaction(async (tx) => {
  if (!(await lockExistingRow(tx, "Venta", ventaId))) return;
  // ... el trabajo, seguro de correr una sola vez
});
```

La segunda ejecución espera a que la primera termine, ve la fila ya eliminada (o
ya cerrada) y sale **antes de tocar nada**. Helpers en `src/lib/dbLocks.ts`:

- `lockExistingRow` — la fila debe existir.
- `lockActiveRow` — además no debe estar soft-deleted (`deletedAt IS NULL`).

Cuando no hay fila que bloquear (crear el primer período de una tienda), la
herramienta es un **advisory lock** por clave de negocio:
`pg_advisory_xact_lock(hashtext(tiendaId))`. `FOR UPDATE` no sirve ahí: no
bloquea nada si el conjunto viene vacío.

> **Ojo con el orden en soft deletes.** Marcar `deletedAt` *antes* del trabajo
> parece un claim atómico elegante, pero `CreateMoviento` resuelve el
> `ProductoTienda` filtrando por `deletedAt: null`: marcarlo primero le hace no
> encontrar la fila y **crear una nueva** en vez de descontar la existencia. Por
> eso se bloquea y verifica al principio, y se marca al final.

## Auditoría de PUT/DELETE (2026-07-30)

La regla deja 23 PUT y 20 DELETE reintentándose. **PUT y DELETE son idempotentes
solo si el handler está escrito así** — el verbo no lo garantiza. Se auditaron
los handlers que aplican deltas (`increment`/`decrement`) o crean registros.
Los seis con hallazgos ya fueron corregidos con el patrón de arriba:

| Endpoint | Qué pasaba | Corrección |
|---|---|---|
| `DELETE /api/productos/[id]` | Sin transacción envolvente y con `CreateMoviento` fuera de tx: un reintento solapado registraba un **segundo AJUSTE_SALIDA / CONSIGNACION_DEVOLUCION** → existencia negativa y kardex con dos salidas. | Todo en una transacción (`CreateMoviento` acepta ahora la tx del llamador) con `lockActiveRow` al inicio y el `deletedAt` al final. |
| `PUT /api/cierre/[tiendaId]/open` | `FOR UPDATE` no protege sin período previo ni revela el que otra tx acaba de insertar → **dos períodos abiertos**. | Advisory lock por tienda antes de la lectura. |
| `DELETE /api/venta/[...]/[ventaId]`, `DELETE /api/app/venta/[...]/[ventaId]`, `DELETE /api/venta/[...]/producto/[...]` | Revertían stock con `increment` y solo se salvaban porque el `delete` final lanzaba P2025 y revertía la transacción entera — protección accidental y dependiente del orden de las operaciones. | `lockExistingRow` al inicio: se sale antes de trabajar, en vez de deshacer al final. |
| `PUT /api/cierre/[...]/close` | La guarda de `fechaFin` estaba fuera de la transacción; solo lo salvaban los `@@unique` de `ResumenMonedaCierre` y `ProductoProveedorLiquidacion`. | `FOR UPDATE` sobre el período y re-verificación de `fechaFin` bajo el lock (`PERIOD_ALREADY_CLOSED` → 400). |

Verificado con ejecuciones concurrentes reales contra la base local: en los tres
mecanismos (claim de producto, apertura de período, bloqueo de fila) el efecto se
aplica exactamente una vez.

### Segunda pasada

Se revisaron además los handlers con efectos que la primera búsqueda no cubría
—envío de correo, notificaciones, llamadas externas y acumuladores en JS— y no
apareció nada nuevo. Los `+=` de `close` y `productos_tienda` son acumuladores
locales del cálculo, no incrementos en base; `usuarios/[id]` y `notificaciones/[id]`
se cortan solos con su guarda `deletedAt: null` y escriben valores absolutos.

## Verificación dinámica (2026-07-31)

Se ejecutaron reintentos reales — secuenciales y concurrentes, misma
`Idempotency-Key` — contra un servidor local para COMPRA, AJUSTE_ENTRADA,
AJUSTE_SALIDA, MERMA, VENTA (`syncId`), DEVOLUCION_VENTA y
`DELETE /api/productos/[id]`, verificando en cada caso que el efecto en BD
(existencia, filas de `MovimientoStock`/`Venta`) se aplica exactamente una
vez. Dos hallazgos de esa pasada, ambos corregidos:

- **`POST /api/venta/[tiendaId]/devolucion/[ventaId]`** comprobaba
  `cantidadDisponible` (basado en lo ya devuelto) **antes** de mirar si la
  clave ya se había procesado. Un reintento que llegaba después de que la
  ejecución original ya había registrado la devolución se topaba con "0
  disponibles" y recibía un 400 de negocio en vez del replay — la devolución
  sí se había aplicado (una sola vez, sin duplicar), pero el reintento dejaba
  de ser transparente. Se movió `findIdempotentResponse` justo después de
  construir `claim`, antes de cualquier lectura que dependa del efecto ya
  aplicado.
- **`DELETE /api/productos/[id]`** devolvía 404 en un reenvío si esa tienda
  era la última activa del producto: el borrado también marca `deletedAt` en
  el `Producto` maestro, y el lookup inicial filtraba por `deletedAt: null`,
  así que un reintento no encontraba nada. Ahora se busca el producto sin ese
  filtro y, si ya está eliminado, se responde éxito (`duplicado: true`) en
  vez de 404 — mismo criterio que el resto de endpoints protegidos.

### Qué NO cubre esto

- **Doble click / doble submit humano.** La política del interceptor solo
  gobierna reintentos de red. Los formularios se protegen aparte (guard de
  `saving` + clave estable en un ref).
- **Los POST sin clave** (`/api/movimiento/import`, `/api/movimiento/rechazo` y
  el resto): ya no se reintentan solos, así que el vector de red está cerrado,
  pero no están blindados contra un reenvío deliberado. Adoptar el helper
  cuando haga falta.
- **Los flujos internos que llaman `CreateMoviento`** (venta, devolución,
  desagregación, import) no llevan clave: no vienen de un cliente que reintente.
