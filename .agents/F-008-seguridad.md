# F-008 — Auditoría de seguridad de la superficie (paso 4, en paralelo con arch-guardian)

> Escrito por `security-guardian`. No toca `.agents/specs/F-008.md` ni `docs/adr/`.
> Todo lo verificado abajo se hizo leyendo y, donde fue posible, ejecutando/comparando
> código real — no se afirma protección por la sola mención de `negocioId` (E-042).

## Resumen ejecutivo

La superficie de F-008 es auditable de punta a punta porque el endpoint receptor de QAB
ya existe y ya está bien construido en el punto más peligroso (el oráculo de enumeración,
criterio 4). El riesgo real de este feature está del lado de cuadrecaja, en tres sitios
muy concretos: (a) cómo se parametriza el SQL espejo, (b) cómo se acota por `negocioId`
la escritura masiva de recuperación sobre `ProductoTienda` (que no tiene columna
`negocioId` propia), y (c) que la alerta nunca se escriba con `negociosDestino` vacío,
porque vacío en este modelo significa "todos los negocios", no "ninguno" — el fallo
abierto más peligroso posible para una alerta que puede nombrar la tienda y el negocio
afectado.

No hay hallazgos que reportar al equipo de QAB: el punto que el spec pedía verificar
ejecutando (criterio 4) está correctamente implementado de su lado.

---

## 🔴 Crítico — de este feature, hay que resolverlo en el contrato antes del paso 5

### C1. La escritura de recuperación (`dispPublicada = NULL`) debe acotarse por `tiendaId` Y por `tienda: { negocioId }`, nunca solo por `tiendaId`

`ProductoTienda` no tiene columna `negocioId` propia (`prisma/schema.prisma:418-462`): solo
tiene `tiendaId`, y `Tienda.negocioId` es el FK real (`prisma/schema.prisma:230-231`). El
criterio 2 del spec pone `dispPublicada = NULL` en "todas las filas de `ProductoTienda`
de esa tienda", disparado por una respuesta de hash que viene de **otra organización**. Si
el `tiendaId` usado en el `updateMany` viniera de un parámetro que no se revalida contra
el negocio del token, un negocio A podría (por bug, no por ataque directo — el propio
token ya limita qué `storeId` se puede consultar, ver C4) desencadenar una escritura sobre
una tienda que no es la que cree.

Hay un precedente exacto ya en el repo para esto, y es la plantilla a copiar literalmente:
`writeDispPublicada` en `src/lib/qab/qabAvailabilityQuery.ts:99-119`:

```ts
const { count } = await qabPrisma.productoTienda.updateMany({
  where: { id: { in: group.productoTiendaIds }, tienda: { negocioId } },
  data: { dispPublicada: group.availability },
});
```

Con el comentario que documenta exactamente esta amenaza (línea 96-98): *"`tienda: { negocioId }`
is NOT omitted, even though the ids came from a query already filtered by that business:
they travelled through a third party's response."* F-008 recibe su hash de un tercero de la
misma forma. La recuperación de F-008 debe escribir así:

```ts
await qabPrisma.productoTienda.updateMany({
  where: { tiendaId, tienda: { negocioId } },
  data: { dispPublicada: null },
});
```

**Nunca** `where: { tiendaId }` a secas. El `negocioId` que entra en ese `where` tiene que
venir de la resolución interna del `storeId` contra el negocio (ver C4), nunca del cuerpo
de la respuesta de QAB ni de un parámetro suelto de la función.

### C2. `Notificacion.negociosDestino` vacío significa "todos los negocios" — la escritura automática de F-008 nunca puede omitirlo

`prisma/schema.prisma:1101`: `negociosDestino String @default("") // ... (vacío = todos)`.
Confirmado en la lectura real, `src/app/api/notificaciones/activas/route.ts:88-90`: si
`negociosDestino` está vacío, `verificarAccesoUsuario` devuelve `true` sin excepción — la
notificación la ve **cualquier usuario de cualquier negocio**. Esto es el `fail-open` más
peligroso que existe en este modelo: no es "no se ve la alerta", es "la ve todo el mundo".

Para F-008 esto es grave porque el contenido de la alerta previsiblemente nombra el
negocio y/o la tienda afectada (igual que `checkSubscriptionExpiration` construye su
`titulo` con `negocio.nombre`, `src/services/notificationService.ts:159`). Un bug que deje
`negociosDestino` sin poblar en la escritura automática de F-008 no falla en silencio: **le
informa a todos los negocios del nombre y el estado de sincronización de otro**, que es
justo el tipo de fuga entre tenants que este proyecto no tolera.

**Restricción para el implementer:** todo `NotificationService.createAutomaticNotification`
/ `updateNotification` que escriba la alerta de divergencia (criterio 2) o la de
sincronización parada (criterios 5/8) debe fijar `negociosDestino: negocioId` de forma
obligatoria y no condicional — nunca `negociosDestino: data.negociosDestino || ""` heredado
sin más del helper genérico (`src/services/notificationService.ts:36`, que si `data`
llegara sin el campo lo dejaría en `""`, es decir "todos"). Si el arquitecto define un
helper propio para F-008, ese helper no debe aceptar un `negociosDestino` opcional: debe
exigirlo como parámetro obligatorio del tipo `string` (no `string | undefined`), para que
un olvido no compile en vez de fallar en producción.

---

## 🟠 Alto

### C3. El SQL espejo: parametrización obligatoria, y una fuente de verdad para la copia del §5

El §5 del contrato (`sync-contract.md` líneas ~2327-2338, v12.1) publica:

```sql
SELECT count(*) AS products,
       md5(coalesce(string_agg(
              pt."id" || ':' || ... || ':' ||
              pt."monedaPrecioCode" || ':' ||
              coalesce(pt."dispPublicada", 'AVAILABLE') || '|',
              '' ORDER BY pt."id" COLLATE "C"
            ), '')) AS hash
FROM "ProductoTienda" pt
JOIN "Producto" p ON p.id = pt."productoId"
WHERE pt."tiendaId" = $1
  AND p."publicarEnTienda" = true
  AND pt."precio" IS NOT NULL
  AND pt."monedaPrecioCode" IS NOT NULL
  AND p."deletedAt" IS NULL
  AND pt."deletedAt" IS NULL;
```

Es texto de un documento de otra organización pegado en este repo: la forma correcta de
llevarlo a producción es exactamente el patrón que ya usa
`readDivergentAvailabilityRows` (`src/lib/qab/qabAvailabilityQuery.ts:31-59`) y
`claimOutboxBatch` (`src/lib/qab/outboxDrain.ts:66-76`):

- **`qabPrisma.$queryRaw` con tagged template**, nunca `$queryRawUnsafe`. El único uso de
  `$queryRawUnsafe` en el repo (`src/lib/dbLocks.ts:29,51`) es para interpolar un **nombre
  de tabla de una unión cerrada que nunca viene de input** — no aplica aquí, donde lo único
  dinámico es el valor de `tiendaId`.
- **`tiendaId` entra como `${tiendaId}`** dentro del tagged template (Prisma lo parametriza
  solo). **Prohibido** construir el SQL con interpolación de cadena (`` `...WHERE tiendaId = '${tiendaId}'` ``)
  aunque `tiendaId` sea un UUID interno: es exactamente el patrón que
  `qabAvailabilityQuery.ts` evita a propósito (ADR 0048, citado en el comentario de esa
  función).
- Si alguna parte del SQL necesita ser literal fijo (por ejemplo, la expresión del
  `trim`/`round` del precio, que no depende de ningún input), **eso sí** puede envolverse
  en `Prisma.raw(...)` — pero solo si es una **constante de módulo definida en
  `src/constants/qab.ts`**, exactamente como `QAB_AVAILABILITY_CASE_SQL`
  (`src/constants/qab.ts:472-474`). `Prisma.raw` nunca debe recibir nada derivado de
  `tiendaId`, del negocio o de la respuesta de QAB.
- **Ejecutar el SQL espejo en `qabPrisma`**, no en `prisma` (el cliente compartido de la
  POS): es una operación de lectura del módulo QAB, del mismo tipo que
  `readDivergentAvailabilityRows`, y debe entrar por el pool dedicado de ADR 0015 — un
  `EXPLAIN` lento sobre `ProductoTienda` en el pool de la POS es exactamente lo que ADR
  0015 existe para evitar.

**El DTO/hash no debe arrastrar columnas prohibidas.** Confirmado por lectura del SQL: el
espejo solo toca `pt."id"`, `pt."precio"`, `pt."monedaPrecioCode"`, `pt."dispPublicada"` y,
para el filtro, `p."publicarEnTienda"`/`p."deletedAt"`/`pt."deletedAt"`. Ninguna columna de
costo, margen, `existencia`, `umbralBajo` o proveedor entra en la proyección — igual que
`readDivergentAvailabilityRows` explícitamente documenta que "neither `existencia` nor
`umbralBajo` ever leaves the database" (`qabAvailabilityQuery.ts:26`). El SQL espejo de
F-008 debe conservar esa misma disciplina: **ninguna columna fuera de las cuatro del hash
debe aparecer en el `SELECT`**, ni siquiera para depuración.

### C4. `storeId` de otro negocio: verificado que QAB responde igual en los dos casos — pero cuadrecaja necesita su propia resolución interna de todos modos

Se leyó el repo de QAB clonado
(`queandabuscando/src/app/api/internal/reconciliation/route.ts` y
`queandabuscando/src/features/sync/server/reconciliation.ts`), no se asumió por el spec:

```ts
// route.ts
const result = await storeReconciliationHash(caller.businessId, storeId);
if (!result) {
  return NextResponse.json({ error: "UNKNOWN_STORE" }, { status: 404 });
}
```

```ts
// reconciliation.ts
const store = await prisma.store.findFirst({
  where: { externalId: storeExternalId, businessId },
  select: { id: true },
});
if (!store) return null;
```

**Un solo camino de código para los dos casos**: "ajeno" y "no existe" llegan al mismo
`findFirst` con la misma forma de consulta (mismo `where`, misma cardinalidad de índice) y
al mismo `if (!store) return null` → mismo 404, mismo cuerpo, sin rama que distinga. El
test propio de QAB (`route.test.ts`, caso *"responde 404 UNKNOWN_STORE cuando la tienda no
existe o es de otro negocio"*) ejercita exactamente esta unificación. **No hay timing
diferencial estructural** (misma query, mismo plan) más allá del ruido normal de red — no
hay nada que reportar al equipo de QAB en este punto.

Lo que sí es responsabilidad de cuadrecaja, y donde el criterio 4 tiene una segunda mitad
que si toca este lado: **la corrida de reconciliación de cuadrecaja debe resolver por sí
misma el `negocioId` de la tienda ANTES de llamar a QAB**, no confiar en el 404 de QAB como
única guarda. Concretamente:

1. La corrida por negocio (probablemente derivada de `eligible` en
   `runQabSyncTiendaCron`, `src/lib/qab/syncTiendaCron.ts:109-114`, el mismo patrón
   `prisma.negocio.findMany({ where: { qabToken: {not: null}, tiendaOnlineHabilitada: true }})`)
   debe iterar **tiendas que ya se sabe que pertenecen a ese negocio** — es decir, el
   `storeId` que se envía a QAB sale de `tienda.tiendaId` leído con un `where: { negocioId }`
   propio, nunca de un parámetro externo o de una lista global de tiendas sin filtrar.
2. Un 404 `UNKNOWN_STORE` en la respuesta de QAB, con esa disciplina, solo puede significar
   "QAB todavía no conoce esa tienda" (p.ej. no aprovisionada) — nunca "cuadrecaja intentó
   leer la tienda de otro negocio", porque esa posibilidad ya está descartada por
   construcción antes de llamar. El spec ya dice qué hacer con el 404 (no dispara
   recuperación, no interrumpe las demás tiendas): la nota de seguridad es que ese 404
   nunca debe ser el único lugar donde se decide el aislamiento — solo el resultado
   esperable de una tienda no aprovisionada del lado de QAB.

### C5. El cron: copiar `isValidCronAuth`, no la comparación `!==` de los dos crones viejos

Se confirmó leyendo los cuatro crones existentes:

- **Correctos** (fail-closed real): `sync-tienda/route.ts:20-22` y
  `purge-outbox-events/route.ts:18-20`, los dos vía `isValidCronAuth(authHeader,
  process.env.CRON_SECRET)` (`src/lib/cronAuth.ts:12-20`), que empieza con
  `if (!secret) return false` — sin `CRON_SECRET` definido, **nunca** hay match posible.
- **Incorrectos** (el "dos crones viejos" que el backlog menciona, identificados aquí por
  primera vez con nombre y línea): `purge-expired-freemium-landing-business/route.ts:83-85`
  y `purge-expired-idempotency-keys/route.ts:9-11`, los dos con:
  ```ts
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... 401 ... }
  ```
  Si `CRON_SECRET` no está definido, `process.env.CRON_SECRET` es `undefined` y la plantilla
  produce el string literal `"Bearer undefined"`. **Cualquier llamante que mande el header
  `Authorization: Bearer undefined` pasa la guarda** cuando el secreto no está configurado —
  exactamente el fail-open que ADR 0014 prohíbe y que `isValidCronAuth` existe para cerrar.

**Restricción para el implementer:** el endpoint o cron nuevo de F-008 usa `isValidCronAuth`
de `src/lib/cronAuth.ts`, con la firma exacta de `sync-tienda/route.ts:19-22`. Prohibido
reescribir la comparación a mano con `!==`, y prohibido asumir que "ya hay un `CRON_SECRET`
en producción" como justificación para relajar la guarda.

---

## 🟡 Medio

### C6. El token del negocio (`Negocio.qabToken`): la ruta de lectura ya es segura; el riesgo nuevo es de dónde sale el `error` que puede acompañar la llamada

Auditado `qabToken.ts`, `qabPrisma.ts` y el `omit` global de `prisma.ts`:

- `src/lib/prisma.ts:9` y `src/lib/qab/qabPrisma.ts:19` aplican `omit: { negocio: { qabToken: true } }`
  al cliente compartido y al cliente QAB dedicado — el token nunca sale de una consulta que
  no pida `select: { qabToken: true }` explícito (ADR 0006/0013).
- `loadQabToken` (`qabToken.ts:14-21`) hace exactamente ese `select` explícito, y su propio
  docstring documenta que "the only caller... puts it in an Authorization header and
  forgets it" — no hay ninguna ruta hoy que devuelva el valor a un log.
- El **nuevo** cliente de reconciliación que F-008 va a escribir debe seguir el patrón ya
  establecido en `qabCatalogClient.ts` / `qabAvailabilityClient.ts`
  (`postQabCatalogBatch`/`postQabAvailabilityBatch`): `fetch` con
  `AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS)`, `readBoundedBody` para no materializar una
  respuesta sin límite, y **nunca** interpolar el token fuera del header `Authorization`
  (no en la URL, no en el cuerpo, no en un mensaje de error).
- **E-031, aplicado a este cliente nuevo:** el `JSON.parse` del cuerpo de
  `{ products, hash }` puede citar el fragmento del cuerpo en su `SyntaxError` si QAB
  responde algo mal formado. La respuesta de reconciliación no lleva credenciales ni PII
  (solo un conteo y un hash), así que el riesgo de fuga de datos sensibles es menor que en
  F-010/F-011 — pero el `error` que resulte de esa rama **no debe usarse tal cual como
  `descripcion` de la `Notificacion`** (ver C2/C3 sobre qué sí puede verse): usar un código
  fijo del estilo `QAB_SYNC_API_ERRORS` (ya existente en `src/constants/qab.ts:117`), nunca
  el mensaje crudo del `catch`, ni siquiera cuando "parece inofensivo" — es exactamente el
  razonamiento que costó una nota completa en E-031 ("comprobar que el contenido que
  atraviesa el nuevo cliente es igual de inofensivo" en vez de asumirlo por parecido de
  forma).
- El código de estado HTTP inesperado (ej. un 200 con cuerpo vacío, o el propio 404
  `UNKNOWN_STORE` que el spec ya cubre) debe ir por la misma rama de "outcome tipado" que
  usan los dos clientes hermanos (`{ kind: "ok" } | { kind: "error" }`), no por una
  excepción que suba sin tipar hasta el cron.

### C7. Ninguna columna `@unique` global entra en juego en el camino de recuperación (E-043 revisado, no aplica aquí — pero queda una nota para el arquitecto)

Se revisó específicamente si el mecanismo de "última corrida exitosa" (terreno nuevo,
ninguna tabla existe todavía) pudiera introducir sin querer un eje de idempotencia global
al estilo de `Venta.syncId` (E-043). No hay hallazgo porque la tabla no existe aún, pero es
una restricción a dejar explícita para el arquitecto: si el seguimiento de "corrida
exitosa" se modela como una fila por negocio con una clave `@unique`, esa clave debe ser
**compuesta con `negocioId`** o derivada 1:1 de `negocioId` (p. ej. `negocioId` como PK de
la tabla nueva, o `@@unique([negocioId, ...])` si hace falta granularidad por tienda) —
nunca una clave de idempotencia standalone (un `runId`, un `token` de corrida) que alguien
pudiera después usar para un `findUnique` sin filtro de tenant, que es exactamente el
mecanismo que abrió la puerta trasera en F-021.

### C8. `NotificationService.findExistingNotification` deduplica por `titulo` + `negocioId`, no por tienda — riesgo funcional que roza el criterio 8 a nivel de tienda

`findExistingNotification(titulo, negocioId)` (`src/services/notificationService.ts:51-68`)
usa `titulo: { contains: titulo }` y, si se pasa `negocioId`, `negociosDestino: negocioId`
(igualdad exacta) — confirmado correctamente **acotado por negocio**, sin fuga entre
tenants. Pero si un negocio tiene más de una tienda y el título de la alerta de divergencia
no incluye un identificador de tienda, una corrida que "cierra" la alerta de la tienda A
(criterio 7: el hash vuelve a coincidir) podría, por la búsqueda `contains`, encontrar y
actualizar/eliminar la notificación de la tienda B del mismo negocio si comparten el mismo
título genérico. No es fuga entre negocios (fuera del alcance estricto de este informe),
pero es la misma familia de riesgo que el criterio 8 ya nombra ("el éxito de uno no debe
enmascarar el corte de otro") un nivel más abajo, a nivel de tienda dentro del mismo
negocio. **Restricción para el implementer:** el `titulo` de la alerta de divergencia debe
incluir el `tiendaId` o el nombre de la tienda de forma que el `contains` no cruce dos
tiendas del mismo negocio.

---

## 🟢 Bajo / informativo

- El SQL espejo debe ejecutarse contra `qabPrisma`, no contra `prisma`: es una lectura del
  módulo QAB y así respeta ADR 0015 (ver C3). Si el arquitecto decide que la corrida vive
  en el mismo `runQabSyncTiendaCron`, la conexión a usar sigue siendo la del pool
  dedicado.
- La alerta de "cron detenido 30 minutos" (criterios 5/8) va a necesitar leer, para cada
  negocio, cuándo fue su última corrida exitosa — si esa lectura se hace con
  `findMany`/`findFirst` sin `where: { negocioId }` y se filtra después en memoria (el
  mismo patrón que `notificaciones/activas/route.ts:20-29`, que trae TODAS las
  notificaciones activas de TODOS los negocios y filtra en aplicación), no es una fuga por
  sí sola porque el filtrado posterior es correcto, pero si esa misma lista se llegara a
  loguear o a exponer en un endpoint de depuración sin el mismo filtrado, sí lo sería.
  Preferible: filtrar por `negocioId` en el propio `where` de Prisma cuando la cardinalidad
  lo permita, en vez de traer todo y filtrar en JS.

---

## ✅ Fortalezas de seguridad (patrones a reutilizar tal cual)

- `writeDispPublicada` (`qabAvailabilityQuery.ts:99-119`) es la plantilla correcta y ya
  probada para "escritura masiva sobre `ProductoTienda` disparada por una respuesta
  externa, acotada por `tienda: { negocioId }`". F-008 debe copiar esta forma
  literalmente para su propia recuperación.
- El aislamiento del token (`omit` global + `select` explícito en el único lector,
  ADR 0006/0013) está bien cerrado y no necesita cambios para F-008.
- El endpoint receptor de QAB (`reconciliation/route.ts` + `reconciliation.ts`) ya
  resuelve el criterio 4 correctamente: un solo camino de código para "ajeno" e
  "inexistente", verificado leyendo el código y su test, no supuesto.
- El patrón de cron fail-closed (`isValidCronAuth`) ya existe, está probado, y es
  trivial de reutilizar sin reinventar nada.
- El patrón de cliente HTTP saliente (`qabCatalogClient.ts`/`qabAvailabilityClient.ts`):
  timeout, cuerpo acotado, outcome tipado, taxonomía de errores por código — es una base
  sólida para el cliente de reconciliación que falta escribir.

---

## Qué es de este feature vs. deuda preexistente a no empeorar

**De este feature (hay que resolverlo en el contrato de F-008):**
- C1 (escritura de recuperación acotada por negocio) — terreno nuevo, cero precedente
  propio, aunque hay plantilla directa en F-007.
- C2 (negociosDestino nunca vacío en la escritura automática) — terreno nuevo.
- C3 (parametrización del SQL espejo) — terreno nuevo.
- C4, segunda mitad (resolución interna de tienda→negocio antes de llamar a QAB) —
  terreno nuevo.
- C5 (cron fail-closed) — terreno nuevo si F-008 añade un cron/endpoint propio.
- C6 (cliente HTTP nuevo, disciplina de logging) — terreno nuevo.
- C8 (unicidad del título de alerta por tienda) — terreno nuevo.

**Deuda preexistente, no empeorar (no es responsabilidad de F-008 arreglarla, pero
tampoco hay que replicar el patrón malo en código nuevo):**
- Los dos crones viejos con `!==` en vez de `isValidCronAuth`
  (`purge-expired-freemium-landing-business`, `purge-expired-idempotency-keys`) — ya
  identificados por nombre y línea en C5. No están en el camino de F-008, pero si algún
  agente futuro los toca, que use esta ficha como referencia de qué copiar y qué no.
- `notificaciones/activas/route.ts` trae todas las notificaciones activas del sistema y
  filtra en memoria (nota informativa) — funcionalmente correcto hoy, pero no es el
  patrón a copiar para consultas nuevas si la cardinalidad crece.

## Nada que reportarle al equipo de QAB

El único punto que el spec pedía verificar ejecutando contra su repo (criterio 4, el
posible oráculo de enumeración) está correctamente implementado de su lado: mismo código,
mismo 404, mismo cuerpo para "ajeno" e "inexistente", con test propio que lo ejercita. No
hay hallazgo que cruce la frontera de organización.

## Restricciones concretas para el `implementer`

1. La escritura de recuperación (`dispPublicada = NULL`) es SIEMPRE
   `where: { tiendaId, tienda: { negocioId } }` — nunca `tiendaId` a secas. Copiar la forma
   de `writeDispPublicada` (`qabAvailabilityQuery.ts:99-119`).
2. Toda escritura automática de `Notificacion` de este feature fija `negociosDestino:
   negocioId` como valor obligatorio, nunca opcional ni heredado de un default vacío.
3. El SQL espejo va por `qabPrisma.$queryRaw` con tagged template; `tiendaId` como
   parámetro bindeado (`${tiendaId}`); `$queryRawUnsafe` prohibido; cualquier fragmento
   fijo que necesite `Prisma.raw` debe ser una constante de `src/constants/qab.ts`, nunca
   una cadena construida en la función. El `SELECT` no proyecta ninguna columna fuera de
   `id`, `precio`, `monedaPrecioCode`, `dispPublicada` (más lo estrictamente necesario del
   `WHERE`).
4. La corrida resuelve `tienda → negocio` de forma propia e independiente de la respuesta
   de QAB antes de llamar al endpoint; el 404 `UNKNOWN_STORE` de QAB nunca es la única
   guarda de aislamiento de este lado.
5. El cron/endpoint nuevo usa `isValidCronAuth` (`src/lib/cronAuth.ts`) exactamente como
   `sync-tienda/route.ts`. Prohibida la comparación `authHeader !== \`Bearer ${secret}\``
   a mano.
6. El cliente HTTP de reconciliación sigue la forma de `postQabCatalogBatch` /
   `postQabAvailabilityBatch`: timeout, `readBoundedBody`, outcome tipado
   `{ kind: "ok" | "error" }`, nunca el token ni el cuerpo crudo de la respuesta en un
   mensaje de error que pueda llegar a un log o a la `descripcion` de una `Notificacion`.
7. El `titulo` de la alerta de divergencia incluye un identificador de tienda para que la
   búsqueda `contains` de `findExistingNotification` no cruce dos tiendas del mismo
   negocio.
8. Si la tabla nueva de "última corrida exitosa" usa una clave única propia, esa clave
   debe incluir `negocioId` (o ser `negocioId` mismo) — nunca un identificador de corrida
   standalone reutilizable como columna de idempotencia sin filtro de tenant.
