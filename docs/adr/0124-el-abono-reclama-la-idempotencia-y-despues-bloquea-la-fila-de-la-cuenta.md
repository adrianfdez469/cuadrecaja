# ADR 0124: El abono reclama la idempotencia y después bloquea la fila de la cuenta

**Estado:** aceptado · **enmendado el 2026-09-10** (ver el final: el bloqueo se exporta, y sigue teniendo una sola declaración)
**Fecha:** 2026-09-09
**Feature:** F-035 (panel de cuentas por cobrar y registro de cobros)

> Fija el orden exacto de las operaciones del cobro. Son dos problemas distintos —**el mismo**
> abono enviado dos veces, y **dos** abonos distintos a la vez— con dos mecanismos distintos, y
> confundirlos es lo que produce un saldo negativo o un cobro contado dos veces.

## Contexto

Dos criterios de aceptación de F-035 describen carreras diferentes.

El **criterio 8** es el reenvío: la misma petición, con la misma cabecera de idempotencia, de forma
secuencial. Tiene que devolver la respuesta original, no crear un segundo movimiento y no bajar el
saldo dos veces. Es el caso que el interceptor de reintentos de `axiosClient` produce solo, y el que
produce un usuario que pulsa dos veces.

El **criterio 10** es la concurrencia: dos abonos **distintos** (cabeceras distintas) de 700 cada
uno, en paralelo con `Promise.all`, sobre una cuenta de 1000. Si las dos peticiones leen el saldo
antes de que ninguna escriba, las dos ven 1000, las dos pasan su propia validación de «no supera el
saldo», y el resultado es `1000 − 700 − 700 = −400`.

La idempotencia **no** resuelve el segundo caso: las claves son distintas, así que nada colisiona. Y
un bloqueo de fila **no** resuelve el primero: las dos peticiones son legítimas por separado, se
serializarían, y la segunda aplicaría el abono otra vez sobre el saldo ya reducido.

El mecanismo de idempotencia ya existe y no se reinventa: `IDEMPOTENCY_KEY_HEADER`
(`src/constants/idempotency.ts`) y `claimIdempotencyKey` / `findIdempotentResponse` /
`storeIdempotentResponse` (`src/lib/idempotency.ts`), sobre la tabla genérica `IdempotencyKey`. El
docstring de ese módulo dicta el orden, y se **cita**, no se parafrasea (**E-039**):

> *Usage — claim first, store last, both inside the endpoint's own transaction […] Claiming inside
> the transaction is what makes this safe: if the work fails, the rollback releases the key too, so
> the caller can retry with the same one. A key written in a separate transaction would survive a
> failed handler and make the next attempt answer "already done" for something that never
> happened — worse than the duplicate it was meant to prevent.*

Y **E-038** es el fallo concreto que castiga hacerlo al revés: un `P2002` **no se recupera dentro de
la misma transacción** —en PostgreSQL la violación aborta la transacción entera y el `COMMIT`
posterior falla igual—, así que la lectura de la respuesta previa tiene que ocurrir **fuera**.

Para el bloqueo de fila el repositorio ya tiene el patrón: `SELECT … FOR UPDATE` como primera
operación de la transacción, en `src/lib/dbLocks.ts`, en `api/cierre/[tiendaId]/open/route.ts` y en
`api/cierre/[tiendaId]/[cierreId]/close/route.ts`. Lo que no tiene es `CuentaPorCobrar` en la unión
cerrada `LockableTable` de `dbLocks.ts`, que es un archivo compartido sin dueño.

## Decisión

**Los dos mecanismos se usan, en este orden, y el bloqueo vive dentro de la puerta única de
escritura.**

```
fuera de la transacción
  1. sesión, permiso y tenant             -> 403 / 404
  2. findIdempotentResponse(claim)        -> 200 con la respuesta original si ya se procesó

dentro de prisma.$transaction
  3. claimIdempotencyKey(tx, claim)       -> primera operación; un P2002 sale de la transacción
  4. applyMovimientoCuentaPorCobrar(tx, …)
       4a. SELECT … FROM "CuentaPorCobrar" WHERE "id" = $1 FOR UPDATE
       4b. decide sobre el saldo leído BAJO el bloqueo
       4c. inserta la fila y actualiza saldoPendiente / settledAt
  5. storeIdempotentResponse(tx, key, payload)

fuera de la transacción
  6. catch de DuplicateRequestError -> findIdempotentResponse otra vez -> 200
```

Tres cosas que este orden fija y que no son intercambiables:

1. **El `claim` va antes del bloqueo.** Es la primera operación de la transacción, como dice el
   docstring y como ya hace `POST /api/movimiento`. Un reenvío con la misma clave colisiona en el
   índice único **antes** de tocar la cuenta.
2. **El bloqueo vive dentro de `applyMovimientoCuentaPorCobrar`, no en la ruta.** Es la puerta
   única de escritura; si la serialización estuviera en la ruta, el cuarto llamador del helper
   —F-037 con su `AJUSTE_DEVOLUCION`— tendría que acordarse de bloquear. Así no tiene que acordarse
   de nada.
3. **El saldo con el que se decide es el que se leyó bajo el bloqueo**, nunca el que la ruta leyó
   antes para responder el 404. Eso es lo que hace que el perdedor de la carrera del criterio 10
   reciba el saldo **real en ese momento** —300, no 1000—, que es exactamente lo que ese criterio
   comprueba.

**Qué le pasa al perdedor:** su comprobación de saldo falla contra 300, el helper lanza su rechazo,
la transacción hace rollback —y con ella se suelta el `claim`, que es lo que el docstring dice que
tiene que pasar—, y la ruta responde **400** con el saldo pendiente real en el cuerpo. No se
reintenta, no se aplica parcialmente y no se encola.

**Qué NO afirma esta decisión.** No dice «el saldo nunca queda negativo» como propiedad absoluta
(**E-017**). Dice algo más estrecho y comprobable: *toda escritura del libro pasa por
`applyMovimientoCuentaPorCobrar`, que decide bajo un bloqueo exclusivo de la fila de la cuenta, así
que dos movimientos concurrentes sobre la **misma** cuenta se serializan y el segundo ve el saldo
que dejó el primero.* Una escritura directa a la tabla —un `psql`, un script, una ruta futura que se
salte el helper— queda fuera de esa garantía, y por eso el dosier § 5 pide un
`scripts/recalculate-cuentas-por-cobrar.ts` que no es de este feature.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Nivel de aislamiento `Serializable` en la transacción** | Postgres lo resolvería, pero convierte el conflicto en un `40001` que hay que **reintentar** desde fuera, y el reintento vuelve a entrar por una ruta que ya reclamó su clave de idempotencia. Además ninguna transacción del repositorio usa `isolationLevel`; el patrón de la casa es `FOR UPDATE` y está en cinco sitios |
| **Un `UPDATE … WHERE saldoPendiente >= monto` condicional, sin bloqueo previo** | Es atómico y serializa, pero deja el rechazo sin dato: la fila afectada es 0 y no sabes cuál era el saldo. El criterio 9 exige responder **cuál es el saldo real**, y el criterio 10 lo exige otra vez con el valor de ese instante. Habría que releer después, y esa relectura ya no está protegida |
| **Añadir `"CuentaPorCobrar"` a `LockableTable` en `src/lib/dbLocks.ts`** | Es un archivo compartido que ningún feature posee, y sus dos helpers devuelven un booleano de existencia: no traen `saldoPendiente` ni `settledAt`, así que haría falta una segunda lectura de todos modos. Se hace la consulta dentro del propio helper, con el nombre de tabla literal en el SQL —no interpolado desde ninguna entrada— y el id parametrizado |
| **Solo idempotencia, sin bloqueo** | Cubre el criterio 8 y deja el 10 exactamente como el criterio lo describe roto: dos claves distintas no colisionan en nada |
| **Solo bloqueo, sin idempotencia** | Cubre el criterio 10 y deja el 8 roto: dos peticiones idénticas secuenciales se serializan sin problema y aplican el abono **dos veces**, que es justo lo que el criterio prohíbe |
| **Capturar el `P2002` del `claim` dentro de la transacción y responder ahí mismo** | **E-038**, literal. En PostgreSQL la violación aborta la transacción entera: el `catch` no la revierte y el `COMMIT` posterior falla igual. Es el error que el protocolo del criterio 8 está escrito para detectar |

## Consecuencias

**A favor:**

- Los criterios 8 y 10 se cierran con mecanismos separados, cada uno resolviendo el problema que le
  toca.
- Todo el que escriba en el libro —hoy tres rutas, mañana la devolución de F-037— hereda la
  serialización sin escribir una línea.
- El rechazo del perdedor lleva el saldo **de ese instante**, que es lo que el cajero necesita ver
  para volver a intentarlo con la cifra correcta.

**En contra / coste asumido:**

- **El bloqueo se toma en toda escritura, incluidas las que no compiten.** Un perdón de deuda sobre
  una cuenta que nadie más toca paga un `SELECT … FOR UPDATE` que no le hacía falta. Es una lectura
  por id sobre la clave primaria; el coste es despreciable frente a tener cuatro llamadores
  acordándose de bloquear.
- **Las escrituras sobre la misma cuenta se serializan de verdad.** Dos cajeros cobrando a la vez
  al mismo cliente esperan uno por otro. Es el comportamiento que se quiere, pero conviene decirlo:
  la latencia del segundo incluye la del primero.
- **La transacción tiene una consulta cruda.** `applyMovimiento.ts` es el único sitio del feature
  con SQL a mano, y el nombre de la tabla va literal en la plantilla —nunca compuesto a partir de
  una entrada—, con el id como parámetro.
- **El período abierto se comprueba dentro de la transacción pero sin bloquear `CierrePeriodo`.** Un
  cierre que se ejecute exactamente entre la comprobación y el `COMMIT` dejaría el abono en un
  período recién cerrado. La ventana es de milisegundos, el movimiento conserva su `fecha` y el
  motor de cierre lo asigna por ella, y bloquear también el período introduciría un segundo recurso
  en el orden de adquisición —con el `close` de F-032, que ya bloquea esa fila— y con él la
  posibilidad real de un interbloqueo. Se asume, escrito.

**Impacto en seguridad y escalabilidad:**

- **Seguridad:** el `claim` lleva `scopeId = negocioId` y `endpoint`, y `findIdempotentResponse`
  filtra por los dos. Es obligatorio pasar por los helpers: `IdempotencyKey.key` es `@id`
  **global**, no compuesta con el `scopeId`, así que un `findUnique({ where: { key } })` a secas
  devolvería la respuesta de **otro negocio** (**E-043** es esa misma forma en `Venta.syncId`).
- **Escalabilidad:** una fila de `IdempotencyKey` por cobro, purgada por
  `purgeExpiredIdempotencyKeys` con su TTL de 24 h. El bloqueo es por fila, así que cobros a
  clientes distintos no se estorban.
- **Reversión:** quitar el bloqueo deja el criterio 10 roto sin que nada lo señale hasta que dos
  cajeros coincidan. Por eso la comprobación vive en un test de la función pura y no solo en el
  camino asíncrono.


---

## Enmienda del 2026-09-10 — el bloqueo se exporta, y por qué eso no lo saca de su sitio

**Qué dijo este ADR:** *«El bloqueo vive dentro de `applyMovimientoCuentaPorCobrar`, no en la ruta.
Es la puerta única de escritura; si la serialización estuviera en la ruta, el cuarto llamador del
helper —F-037 con su `AJUSTE_DEVOLUCION`— tendría que acordarse de bloquear. Así no tiene que
acordarse de nada.»*

**Qué se vio al implementar.** El razonamiento es correcto y sigue en pie, pero le faltaba un caso:
**un llamador que no puede nombrar su propio importe hasta haber leído el saldo bajo el bloqueo**.
Perdonar una deuda es exactamente eso —el importe *es* el saldo— y revertir un abono también, porque
el importe es el del `ABONO` origen y hay que leerlo dentro de la misma ventana serializada.

Con la firma tal y como estaba, esas dos rutas tenían que pasar un `monto` calculado a partir de la
lectura **anterior** al bloqueo. La consecuencia era medible: el caso trabajado del § 5.2 del
contrato —perdonar una cuenta ya saldada devuelve `MONTO_NO_POSITIVO`— resultaba **inalcanzable**,
porque con un saldo obsoleto de 500 sobre un saldo real de 0 la guarda que dispara es
`SALDO_INSUFICIENTE`. La figura es la **inversa de E-068**: ahí un valor de ejemplo contradecía la
regla general y el valor estaba mal; aquí el valor de ejemplo era el correcto y lo que no se
sostenía era la firma que lo rodeaba.

**La enmienda.** `applyMovimiento.ts` exporta **`lockCuentaPorCobrar(tx, cuentaId)`**, que es **la
única declaración del `SELECT … FOR UPDATE` en el proyecto** —la propia puerta la usa como su primera
operación—. Las rutas de perdonar y de revertir la llaman justo después del `claim`, calculan su
importe con el saldo que devuelve, y llaman a la puerta; tomar el mismo bloqueo dos veces dentro de
una transacción de PostgreSQL es un no-op. La ruta de abono **no la llama**: su importe sale de las
líneas de pago, así que entra directa por la puerta.

**Qué NO cambia, y es la razón de que esto sea una enmienda y no un reemplazo:**

- El orden del ADR sigue siendo el orden: `findIdempotentResponse` fuera → `claim` primero dentro →
  bloqueo → decisión → escritura → `storeIdempotentResponse`.
- **El bloqueo sigue teniendo una sola declaración.** Exportarla no la duplica; lo que se evita es
  precisamente que las dos rutas escribieran su propio `SELECT … FOR UPDATE`, que sí habría sido dos.
- **Nadie tiene que acordarse de bloquear.** Un llamador que solo invoca la puerta —F-037 mañana—
  sigue recibiendo la serialización gratis. Lo que se añade es una puerta lateral **de solo
  lectura** para quien la necesita antes, no un segundo camino de escritura.
- El orden de guardas del contrato (§ 3.1) **no se tocó ni una línea**, que era el riesgo real: moverlo
  habría ensanchado `MONTO_NO_POSITIVO` para todas las demás operaciones (E-032).

**Coste asumido, escrito:** hay ahora un símbolo exportado que toma un bloqueo exclusivo de fila y
que alguien podría llamar fuera de una transacción, donde no serializa nada. Su docstring lo dice y
su firma exige un `Prisma.TransactionClient`, que es lo que lo hace difícil de usar mal.
