# F-027 — Auditoría de seguridad de la superficie (previa a implementación)

> Escrito por el agente `security-guardian`, paso 4 del pipeline, en paralelo con `arch-guardian`.
> No toca `.agents/specs/F-027.md` ni `docs/adr/`. Archivo propio y exclusivo.

## Alcance auditado

- `src/app/api/negocio/[id]/monedas/route.ts` (GET, POST)
- `src/app/api/negocio/[id]/monedas/[code]/route.ts` (PUT, DELETE)
- `src/app/api/negocio/[id]/cambiar-moneda-base/route.ts` (GET, POST)
- `src/app/api/admin/monedas/route.ts` y `src/app/api/admin/monedas/[code]/route.ts`
- `src/lib/negocioConfigAccess.ts`, `src/lib/appNegocioAccess.ts`
- `src/lib/qab/outboxEnqueue.ts`, `outboxDrain.ts`, `outboxAck.ts`, `qabOutboxLog.ts`,
  `qabCatalogEmission.ts`, `qabCatalogEmitters.ts`, `qabCatalogOutboxFilters.ts`,
  `qabCurrencyPayload.ts`, `qabStorePayload.ts`, `qabStoreOutboxFilters.ts`
- `prisma/schema.prisma`: `Negocio`, `NegocioMoneda`, `OutboxEvento`
- `src/schemas/moneda.ts`, `src/schemas/tasaCambio.ts`, `src/schemas/qabCurrency.ts`
- `src/lib/prisma.ts` (config global de Prisma)

Todo lo citado abajo se leyó, no se dedujo. Cada afirmación de "protegido" cita archivo y línea.

---

## Hallazgo 1 — Gap real de F-027, no una vulnerabilidad hoy (GRAVEDAD: alta si se implementa mal)

**`PUT /api/negocio/[id]/monedas/[code]`** (`src/app/api/negocio/[id]/monedas/[code]/route.ts:7-39`)
puede cambiar `activo` (`negocioMonedaUpdateSchema.activo` es opcional,
`src/schemas/moneda.ts:53-57`) y **hoy no emite ningún evento QAB** — ni siquiera dentro de una
transacción: el `update` de la línea 26 es una llamada suelta a `prisma.negocioMoneda.update`, no
`prisma.$transaction`. Lo mismo el `DELETE` (líneas 41-64): solo `activo: false`, sin transacción,
sin emisor.

Esto **no es un agujero de seguridad hoy** (no se emite nada, así que no hay nada que se pueda
fugar), pero es exactamente el punto donde el `implementer` va a añadir la emisión de `BUSINESS`, y
es donde hay que ser estricto:

- La emisión **debe** envolverse en `prisma.$transaction(async (tx) => { ...update...;
  ...emitir...})`, replicando el idioma ya usado en `monedas/route.ts:111-128` (reactivación) y
  `131-138` (creación) — nunca un emisor llamado después del `await` suelto de hoy, porque un
  rollback de la mutación no se llevaría el evento con él.
- El `negocioId` que entra al emisor y al payload **tiene que ser el `id` de los params ya
  verificado por `assertNegocioConfigAccess(session, id)`** (línea 15-16), nunca
  `session.user.negocio.id` releído ni nada derivado del body. Ambos deberían coincidir, pero solo
  `id` es el que ya pasó por la comparación explícita de `assertNegocioAccess`.
- `DELETE` también debe emitir: desactivar una moneda cambia la lista igual que el `PUT` que la
  desactiva, y el criterio 1 de F-027 dice "habilitar **o desactivar**".

## Hallazgo 2 — El riesgo de `businessId` cruzado ya está documentado en el propio repo, y aplica igual a `BUSINESS`

`src/lib/qab/qabCatalogEmission.ts:258-266` (comentario de `planQabCategoryCascade`) advierte, para
`CATEGORY`:

> "An event sitting in B's outbox that carries A's `businessId` makes QAB answer `403
> BUSINESS_MISMATCH` and REJECT B'S WHOLE BATCH, stopping the sync of a business that did nothing."

`src/lib/qab/outboxAck.ts:64-87` (`toQabCatalogBatch`) ya defiende esto **en el drenaje**: lanza
`QabTenantMismatchError` si `row.negocioId !== negocioId` del lote. Pero esa guarda protege el
**drenaje**, no el **encolado**. Nada impide hoy que un payload de `BUSINESS` se construya con un
`businessId` distinto del `negocioId` con el que se llama a `enqueueOutboxEvent`.

Como `BUSINESS` es "un negocio, un evento" (no fan-out, ADR 0091 sección "Consecuencias"), el riesgo
es menor que en `CATEGORY`/`CURRENCY`, pero la disciplina exigida es la misma: **el `negocioId` que
entra a `enqueueOutboxEvent({negocioId, entidadId: negocioId, ...})` y el `businessId` que entra al
payload deben salir de la MISMA variable, leída una sola vez** (el patrón que
`planQabCategoryCascade` exige explícitamente "leído DENTRO del loop, nunca capturado una vez
fuera" — aquí no hay loop, pero el principio de fuente única es el mismo).

## Hallazgo 3 — El índice de `OutboxEvento` no lleva `negocioId`, y la disciplina que lo compensa ya está escrita — `BUSINESS` no puede ser la excepción

`prisma/schema.prisma:1210`: `@@index([entidad, entidadId])` — sin `negocioId`. El propio
`src/lib/qab/qabCatalogOutboxFilters.ts:8-18` lo dice explícito:

> "All of them carry `negocioId` in the `where` when the question is per business, and **NONE
> deduces tenancy from `entidadId` being a UUID**."

Para `BUSINESS`, el `entidadId` natural (espejo del patrón "un negocio, un evento" de `STORE`, donde
`entidadId = tiendaId`) es `entidadId = negocioId`. Como `negocioId` es la PK global de `Negocio`,
no hay colisión posible entre dos negocios **mientras el implementer use `negocioId` verbatim como
`entidadId`, nunca una forma derivada o acortada**. Aun así, **toda consulta futura sobre
`OutboxEvento` filtrada por `(entidad: 'BUSINESS', entidadId)` debe llevar también `negocioId` en el
`where`**, exactamente como ya hacen `readSyncedCategoriaIds`, `readSyncedCurrencyCodes` y
`readSyncedExchangeRateCodes` (mismo archivo, líneas 24-78) — no porque haga falta para desambiguar
hoy, sino porque es la regla ya escrita para las otras cuatro entidades y `BUSINESS` no puede ser la
que la rompe el día que alguien reutilice esa consulta para un panel de administración u otro
propósito que si mezcle negocios.

No se detectó ningún `@unique` global nuevo de este feature (a diferencia de E-043): `BUSINESS` no
introduce columna de idempotencia propia, así que esa clase de error no aplica aquí directamente —
pero el mismo principio ("un eje de tenant que no se ve leyendo el índice") es el que sostiene el
punto anterior.

## Hallazgo 4 — Frontera del DTO: qué NO debe salir en el payload `BUSINESS`

`NegocioMoneda` (`prisma/schema.prisma:986-998`) tiene: `id`, `negocioId`, `monedaCode`,
`admiteEfectivo`, `admiteTransferencia`, `activo`. El contrato v12.1 solo pide
`businessId + displayCurrencies + updatedAt`.

- **`admiteEfectivo` y `admiteTransferencia` son configuración interna de cobro y no deben entrar
  al payload bajo ninguna forma** — ni siquiera indirectamente (p. ej. filtrando la lista por
  `admiteEfectivo === true`, que además violaría el criterio 2 de todos modos).
- El patrón seguro ya existe en el repo y hay que copiarlo literal, no reinventarlo: tanto
  `buildQabStorePayload` (`src/lib/qab/qabStorePayload.ts:38-85`) como `buildQabCurrencyPayload`
  (`src/lib/qab/qabCurrencyPayload.ts:36-55`) construyen el payload con **una lista explícita de
  claves** pasada a `.parse({...})` — nunca spread de la fila de Prisma (`.parse(row)`). El
  `implementer` debe escribir `buildQabBusinessPayload` con la misma forma: `businessId`,
  `displayCurrencies`, `updatedAt`, y nada leído de una fila completa de `NegocioMoneda` o
  `Negocio`.

## Hallazgo 5 — `Negocio.qabToken`: la defensa ya existe, verificar que nadie la esquive

`Negocio.qabToken` (`prisma/schema.prisma:78`) es el token de QAB. El cliente Prisma compartido lo
omite globalmente: `src/lib/prisma.ts:10` — `omit: { negocio: { qabToken: true } }` (ADR 0006). Solo
dos sitios en todo el repo lo seleccionan explícitamente (`src/lib/qab/qabToken.ts:18` y
`loadQabTokens` en `src/lib/qab/outboxDrain.ts:100-103`), ambos server-internal, ninguno expuesto en
una respuesta HTTP.

Ninguna de las cuatro rutas de F-027 selecciona ni incluye `qabToken`, y ninguna debe empezar a
hacerlo. El futuro `buildQabBusinessPayload` debe recibir `negocioId` y `monedaBase`/lista de
códigos como **valores escalares**, nunca una fila `Negocio` completa — así es imposible que
`qabToken` viaje aunque alguien, por error, opte por `omit: { qabToken: false }` en algún `select`
nuevo. **Restricción explícita para el implementer: ninguna función de este feature lee
`Negocio.qabToken`, y ningún `select`/`include` de este feature debe nombrarlo.**

## Hallazgo 6 — E-031: la disciplina de mensajes de error ya es correcta en el código hermano; el implementer debe copiarla, no relajarla

Revisé `qabCurrencyPayload.ts` (`QabCurrencyPayloadError`, líneas 18-28) y `qabStorePayload.ts`
(`QabStorePayloadError`, líneas 14-22): los dos construyen el `Error` con un **mensaje constante**
(`"A currency row cannot produce a valid payload"`, `"Stored opening hours would be rejected..."`)
y nunca interpolan el valor inválido dentro de `super(...)`. El dato problemático (código de moneda,
issues de horario) viaja como **campo estructurado** de la excepción (`.currencyCode`, `.issues`),
no dentro de `.message`. Los cuatro route handlers auditados atrapan todo con
`catch (error) { console.error(error); ... }` (p. ej. `monedas/route.ts:140-146`,
`cambiar-moneda-base/route.ts:269-274`), y `console.error` de un objeto `Error` imprime su
`.message`/`.stack` — así que **cualquier mensaje que interpole el dato roto llega a log**.

El futuro `QabBusinessPayloadError`/`BUSINESS_DISPLAY_CURRENCIES_INVALID` (nota (d) del spec) tiene
que seguir la misma forma exacta: mensaje fijo, dato inválido solo en un campo estructurado. Nada de
`` `Invalid currency code: ${code}` `` en el `super(...)`. No es un riesgo de confidencialidad alto
en sí mismo (un código de moneda no es secreto), pero es la disciplina que sostiene E-031 en todo el
módulo `qab/`, y romperla aquí "porque total no es sensible" es exactamente la lógica que causó las
tres apariciones de E-031 en F-010/F-011 — la regla es estructural, no depende de si el dato de hoy
es sensible.

`src/lib/qab/qabOutboxLog.ts` (revisado completo) ya sigue esta misma disciplina: `código` cerrado,
nunca el error crudo de QAB ni el payload — no hay hallazgo nuevo ahí, solo confirmación de que el
patrón a copiar existe y funciona.

## Hallazgo 7 — Aislamiento verificado en las guardas actuales (no tocar, no relajar)

- `assertNegocioAccess` (`src/lib/appNegocioAccess.ts:8-21`) hace una comparación real:
  `session.user.negocio?.id !== negocioId` (línea 16) — **no** es una guarda de nulidad tipo E-042,
  compara el valor contra el parámetro de la ruta.
- `assertNegocioConfigAccess`/`assertNegocioConfigReadAccess`
  (`src/lib/negocioConfigAccess.ts:18-56`) llaman a `assertNegocioAccess` primero y **después**
  comprueban el permiso (`verificarPermisoUsuario`, línea 46-50) — orden correcto: identidad antes
  que autorización de función.
- Las cuatro rutas de negocio auditadas (`monedas/route.ts` GET/POST, `monedas/[code]/route.ts`
  PUT/DELETE, `cambiar-moneda-base/route.ts` GET/POST) llaman a una de las dos guardas **antes** de
  tocar `NegocioMoneda`/`Negocio`/`TasaCambio`/`ProductoTienda`/`GastoTienda`, y usan `id` de los
  params (ya verificado) en el `where`, nunca el body.
- `negocioMonedaUpdateSchema` (`src/schemas/moneda.ts:53-57`) solo admite `admiteEfectivo`,
  `admiteTransferencia`, `activo` — no hay `negocioId` ni `monedaCode` en el body que pueda
  sobrescribir el `where` (nada de mass assignment sobre el eje de tenant).
- `admin/monedas/route.ts` y `admin/monedas/[code]/route.ts` mutan el catálogo **global**
  `Moneda`, no `NegocioMoneda`: no hay ruta desde ahí para alterar la lista de un negocio ajeno. Y
  no deben conectarse a la emisión `BUSINESS` de este feature — ver Hallazgo 8.

## Hallazgo 8 — Límite de alcance que el implementer no debe cruzar

El criterio 2 de F-027 dice que la lista sale de `NegocioMoneda.activo` + `Negocio.monedaBase` "y de
ninguna otra parte". Eso significa explícitamente que **desactivar una moneda en el catálogo global
desde `admin/monedas/[code]` (DELETE, que hace `activo: false` sobre `Moneda`) NO debe disparar
ningún evento `BUSINESS`** para los negocios que la tienen habilitada en su `NegocioMoneda` propia —
aunque intuitivamente parezca "la moneda ya no está disponible". El ADR 0091 ya descarta esa
derivación explícitamente (tabla de alternativas: "Que QAB derive la lista de las tasas... Falla en
la dirección silenciosa"). Conectar `admin/monedas/[code]` a la emisión de `BUSINESS` sería, además
de fuera de alcance, una fuga del criterio 2 hacia el criterio contrario.

## Hallazgo 9 (deuda preexistente, no de este feature — no empeorar)

- `cambiarMonedaBaseSchema` (`src/schemas/tasaCambio.ts:35-37`) valida `monedaNueva` solo con
  `z.string().min(1)`, sin forma de código ni charset. No es un hueco nuevo de F-027 — el
  payload-builder de `BUSINESS` ya está obligado por el criterio 4 a filtrar por forma antes de
  incluir cualquier código (igual que `qabStorePayload.ts:73-75` hace con `monedaBase`), así que el
  string sin validar de este schema **no puede** colar un código malformado en el payload aunque el
  endpoint en sí siga sin restringirlo. No se pide tocar `cambiarMonedaBaseSchema` en este feature.
- El `catch` genérico `console.error(error)` de las cuatro rutas es el patrón estándar de todo
  `src/app/api/`, no algo que F-027 introduzca — se señala en el Hallazgo 6 porque el feature añade
  una superficie nueva (el emisor `BUSINESS`) que pasará por ese mismo `catch`, no porque el propio
  `catch` sea nuevo.

---

## Restricciones concretas para el `implementer`

1. La emisión `BUSINESS` en `PUT`/`DELETE /monedas/[code]` va **dentro de un
   `prisma.$transaction`** que envuelva también el `update`, replicando el idioma de
   `monedas/route.ts:111-138`. Hoy esas dos rutas no tienen transacción — hay que añadirla, no
   emitir después del `await` suelto.
2. `negocioId` para el emisor y el payload sale del `id` de los params, el mismo que ya validó
   `assertNegocioConfigAccess`/`assertNegocioAccess` — una sola lectura, reutilizada, nunca releída
   de `session` ni tomada del body.
3. `enqueueOutboxEvent({ negocioId, entidadId: negocioId, ... })` y
   `buildQabBusinessPayload({ businessId: negocioId, ... })` deben construirse a partir de la
   **misma variable**, no de dos lecturas independientes — es la defensa contra el
   `BUSINESS_MISMATCH` de todo el lote (Hallazgo 2).
4. Toda consulta nueva sobre `OutboxEvento` filtrada por `entidad: 'BUSINESS'` lleva `negocioId`
   explícito en el `where`, aunque `entidadId` (= `negocioId`) ya desambigüe — regla ya escrita para
   las otras cuatro entidades en `qabCatalogOutboxFilters.ts:8-18`, `BUSINESS` no es la excepción.
5. `buildQabBusinessPayload` construye el payload con **claves explícitas** (`businessId`,
   `displayCurrencies`, `updatedAt`), nunca por spread de una fila de `NegocioMoneda`/`Negocio`.
   Prohibido: `admiteEfectivo`, `admiteTransferencia`, cualquier campo de `NegocioMoneda` que no sea
   la forma final del código, y `Negocio.qabToken` bajo cualquier forma (ni siquiera indirecta vía
   una fila completa de `Negocio`).
6. La clase de error del payload (`BUSINESS_DISPLAY_CURRENCIES_INVALID` de la nota (d)) lleva
   mensaje **constante**, nunca interpola el código inválido en `super(...)` — mismo molde que
   `QabCurrencyPayloadError`/`QabStorePayloadError`.
7. `admin/monedas/**` (catálogo global) **no se conecta** a la emisión `BUSINESS`: fuera de alcance
   por diseño (Hallazgo 8), y conectarlo violaría el criterio 2.
8. Ningún `select`/`include` de este feature nombra `qabToken`.

## Clasificación de gravedad

- **Nada de lo encontrado es explotable hoy** (ninguna ruta filtra datos entre negocios en el
  estado actual del código, ninguna emite `BUSINESS` todavía).
- **De este feature** (hay que resolverlo al implementar, no es deuda previa): Hallazgos 1, 2, 3
  (aplicado a la entidad nueva), 4, 5 (aplicado al payload nuevo), 6 (aplicado a la clase de error
  nueva), 8.
- **Deuda preexistente, no empeorar** (Hallazgo 9): formato débil de `cambiarMonedaBaseSchema`, y el
  `catch` genérico de las rutas — ninguno de los dos se pide corregir en F-027.
