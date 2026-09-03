# ADR 0015: Pool de conexiones dedicado para la transacción larga del drenaje y del lock del pull

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-002
**Emitido por:** `security-guardian`, auditoría obligatoria del contrato de interfaces (paso 4 del
pipeline), antes de que exista código.

## Contexto

El ADR 0010 decide, con buena razón, que una corrida de drenaje es **una sola transacción
interactiva** que reclama el lote, hace los `POST` a QAB de todos los negocios y escribe los
acuses, todo dentro de ella — porque sin esa transacción larga el criterio 4 (lotes disjuntos entre
corridas concurrentes) pasaría a depender de una carrera de milisegundos en vez de cumplirse por
construcción. El ADR 0009 toma la misma decisión de fondo para el advisory lock del pull: el lock
es de **ámbito de transacción** (`pg_try_advisory_xact_lock`), y F-010 sostendrá esa transacción
durante un `GET` HTTP completo.

Los dos ADR ya admiten el coste, con todas las letras:

> ADR 0010, en contra: *"Una transacción abierta durante E/S de red... Consume una conexión del
> pool durante toda la corrida."*

> ADR 0009, en contra: *"F-010 tendrá una transacción abierta durante un `GET` HTTP, con el mismo
> coste que se discute en el ADR 0010 y el mismo remedio: un timeout explícito."*

Lo que ninguno de los dos cierra es **sobre qué pool** se paga ese coste. Hoy solo existe un
`PrismaClient`, el singleton de `src/lib/prisma.ts` (`omit` global del ADR 0006 incluido), y es el
mismo que sirve **todo** el tráfico del POS: cada venta, cada consulta de stock, cada cierre de
caja. `prisma/schema.prisma` no fija ningún `connection_limit` en `DATABASE_URL` — el valor por
defecto de Prisma es `num_physical_cpus * 2 + 1`, que en un entorno serverless (Vercel, una
invocación = un proceso, potencialmente muchas invocaciones concurrentes) suele ser un número
pequeño, y no hay evidencia en el repositorio de un *pooler* externo (PgBouncer, Supabase pooler,
Prisma Accelerate) que lo compense.

El presupuesto de tiempo que fijan las constantes del contrato de F-002 es explícito sobre cuánto
puede durar el coste:

| Constante | Valor | Qué sostiene |
|---|---|---|
| `QAB_SYNC_TX_TIMEOUT_MS` | 45 s | La transacción del drenaje |
| `QAB_ORDER_POLL_TX_TIMEOUT_MS` | 30 s | La transacción del lock del pull, **por negocio** |

Y el cron corre **cada 2 minutos**, sin garantía de que una corrida termine antes de que empiece la
siguiente — es precisamente la premisa del ADR 0009 sobre por qué hace falta el advisory lock. Con
varios negocios pendientes, en el peor caso una corrida sostiene una conexión hasta 45 s, y si la
siguiente arranca encima (porque la anterior se acercó al límite), hay dos conexiones largas
solapadas. El pull, aparte, abre **una transacción por negocio** con lock adquirido: con N negocios
con token, la fase de pull puede sostener conexiones de forma más repartida pero igual de real.

La pregunta que ninguno de los dos ADR anteriores responde es la que importa para la
disponibilidad del sistema completo: **¿qué le pasa a una venta del POS que necesita una conexión
mientras el drenaje sostiene la suya?** Con un pool pequeño y compartido, la respuesta es que esa
venta espera en la cola de Prisma hasta `pool_timeout` (por defecto 10 s) y, si no consigue
conexión a tiempo, falla. Un cron de sincronización con un tercero externo estaría entonces
degradando la disponibilidad del sistema que, en palabras del propio prompt de auditoría, **"es lo
que da de comer"**.

Este no es un hallazgo sobre fuga de datos entre tenants — el aislamiento de negocio a negocio ya
está bien resuelto en otras partes del contrato (`QabTenantMismatchError`, `planOutboxAck`
ignorando ids ajenos, el token leído por negocio). Es un hallazgo de **disponibilidad**: una
funcionalidad que integra con un tercero puede convertirse, por diseño y sin que nadie lo note
hasta que el tráfico crezca, en un vector de denegación de servicio contra el propio POS.

## Decisión

**El drenaje y el lock del pull usan un `PrismaClient` propio (`qabPrisma`,
`src/lib/qab/qabPrisma.ts`), con un pool de conexiones pequeño y separado del que usa `prisma`
para servir al POS.** Agotar el pool de `qabPrisma` — en el peor caso, por un QAB lento o caído que
alarga cada `POST` hasta su timeout de 10 s con varios negocios pendientes — solo hace que la
propia sincronización se ralentice o falle (que es aceptable: los eventos se quedan pendientes para
la corrida siguiente, sin penalizar `intentos` si es por el `deadlineAt`, y el drenaje ya está
diseñado para tolerar eso). Nunca le quita una conexión a una venta.

```ts
// src/lib/qab/qabPrisma.ts
export const qabPrisma: PrismaClient; // pool propio, tamaño QAB_SYNC_DB_CONNECTION_LIMIT (2 por defecto)
```

Tamaño de pool de `2`, elegido para cubrir el caso normal (una corrida de drenaje + como mucho un
solapamiento breve con la siguiente) sin reservar más conexiones de las que la integración necesita
en su volumen actual — la tabla nace vacía, F-002 no emite tráfico real todavía. No es un número
medido bajo carga real porque esa carga no existe aún; es un punto de partida conservador y
fácilmente ajustable por variable de entorno sin tocar código.

`syncTiendaCron.ts` **no** cambia de cliente para el `findMany` de negocios elegibles del pull: es
una lectura corta e indexada (`where: { qabToken: { not: null } }`), no una transacción larga, y no
hay razón para aislarla del pool compartido.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| No hacer nada: el `PrismaClient` singleton ya existe y funciona hoy | Funciona con la tabla vacía. El riesgo es exactamente el que los ADR 0009 y 0010 ya admiten como coste aceptado sin decir sobre qué pool recae — y recae, por defecto, sobre el que sirve las ventas. Es la clase de deuda que "no se nota hasta que se nota". |
| Bajar `QAB_SYNC_TX_TIMEOUT_MS` / procesar menos negocios por corrida | Reduce la duración del peor caso, no lo elimina, y ya está acotado por diseño (35 s + 10 s = 45 s). El problema no es cuánto dura la transacción, es **con quién compite** por la conexión mientras dura. |
| Cola externa (SQS, QStash, pg-boss) fuera del proceso web | Resuelve el problema de raíz —ni siquiera habría una transacción larga en el runtime del POS— pero es una dependencia de infraestructura nueva, ya descartada por el mismo motivo en el ADR 0010. |
| Aumentar el `connection_limit` del pool compartido en vez de separar | No aísla nada: una conexión más grande sigue siendo un recurso compartido, y basta con que el volumen de negocios crezca un poco para volver a agotarlo. Separar el pool acota el **radio de impacto**, no solo la cantidad. |
| Un segundo `PrismaClient` sin el `omit` global, solo para simplificar el token | Es la trampa que el propio ADR 0006 señala: el repositorio tiene un singleton por una razón (la defensa del token) y un segundo cliente sin ella pierde esa defensa. `qabPrisma` mantiene el mismo `omit` — la separación es de **pool**, no de política de datos. |

## Consecuencias

**A favor:**
- Un drenaje lento o un QAB caído degrada la sincronización, nunca al POS. La propiedad más
  importante de este ADR: el fallo se contiene en el subsistema donde se originó.
- El tamaño del pool dedicado es un parámetro de despliegue (`QAB_SYNC_DB_CONNECTION_LIMIT`), no
  una constante en código: se puede subir sin desplegar si el volumen real lo pide.
- No cambia ninguno de los siete criterios de aceptación de F-002 ni las firmas públicas del resto
  del contrato — es un cambio de **qué cliente** llama `$transaction`, no de qué hace la
  transacción.

**En contra / coste asumido:**
- Una conexión de base de datos más reservada permanentemente (el pool dedicado existe aunque no
  haya drenaje en curso), aunque pequeña (2 por defecto).
- El tamaño de `2` es una estimación razonada, no medida bajo carga real — no hay carga real
  todavía. Debe revisarse cuando F-005/F-006 empiecen a emitir tráfico y el número de negocios con
  `tiendaOnlineHabilitada` deje de ser un puñado de prueba.
- Un `PrismaClient` más en el proceso — mismo patrón de singleton en `globalThis` que el existente,
  para no multiplicar clientes en cada *hot reload* de desarrollo (mismo problema que motivó el
  singleton de `src/lib/prisma.ts`).

**Impacto en seguridad y escalabilidad:**
- **Disponibilidad, no aislamiento de datos:** este ADR no cambia nada sobre qué negocio ve los
  datos de cuál — eso ya lo resuelven `QabTenantMismatchError`, `planOutboxAck` y `loadQabTokens`.
  Cambia qué le pasa al sistema completo cuando la integración con un tercero se comporta mal.
- Es la contención de un riesgo que **ya estaba escrito** en las consecuencias de los ADR 0009 y
  0010 como coste aceptado; este ADR lo cierra en vez de dejarlo abierto para cuando el tráfico
  real lo convierta en un incidente de producción.
- **Reversión barata:** si el volumen nunca lo justifica, es una variable de entorno que se puede
  subir para igualar el pool compartido, o un cliente que se puede fusionar de vuelta en `prisma`
  eliminando el archivo. No hay estado persistido que migrar.

## Nota de QA — desviación del tipo exportado (cierre de F-002, 2026-09-02)

Este ADR fija `export const qabPrisma: PrismaClient;` como firma literal. La implementación real
(`src/lib/qab/qabPrisma.ts`) construye el cliente con `omit: { negocio: { qabToken: true } }` —
igual que `prisma` (ADR 0006) — pero **no** exporta el tipo estrechado que ese `omit` produciría
(a diferencia de `src/lib/prisma.ts`, que exporta `ReturnType<typeof createPrismaClient>` para
convertir la lectura de `qabToken` en un error de compilación). En su lugar hace
`return client as unknown as PrismaClient`, documentado en el propio archivo.

**Motivo verificado, no solo alegado:** las firmas que este mismo contrato fija —
`claimOutboxBatch(tx: Prisma.TransactionClient)`, `loadQabTokens(tx: Prisma.TransactionClient, …)`,
`withQabOrderPollLock<T>(negocioId, run: (tx: Prisma.TransactionClient) => …)` — toman todas el tipo
`Prisma.TransactionClient` **ancho**, no `PrismaClientLike` (que si acepta la versión estrecha, ver
`src/lib/prisma.ts`). Si `qabPrisma` se tipara estrecho, el `tx` que entrega su propio
`$transaction(...)` dejaría de ser asignable a esas firmas, y compilar exigiría reescribirlas — un
cambio de contrato, no de implementación. El arquitecto no participó de esta decisión en el
momento en que se escribió (es la desviación 3 del `implementer`, documentada en
`.agents/progress/F-002.md`); QA la revisó al cerrar el feature.

**Efecto concreto de la desviación:** por el cliente compartido `prisma`, leer `.negocio.qabToken`
sin `select` explícito **no compila** (el efecto buscado por el ADR 0006). Por `qabPrisma`, la
misma lectura **compila** (el tipo ancho declara el campo) y devuelve `undefined` en runtime (el
`omit` sigue activo) — la misma protección, pero fallando en silencio en vez de ruidosamente en
`tsc`.

**Decisión de QA: aceptado tal cual, sin bloquear el cierre de F-002.** Ninguno de los siete
criterios de aceptación de F-002 depende de este tipo, y verificado leyendo cada uso de `qabPrisma`
en `src/lib/qab/`: el único lugar que lee `Negocio` a través de él es `loadQabTokens`, con
`select: { id: true, qabToken: true }` explícito — la ruta insegura no se ejercita hoy.

**Por qué queda anotado en vez de cerrado sin más:** `F-010` construye `pullQabOrders` sobre la
transacción que abre `withQabOrderPollLock`, es decir sobre este mismo `qabPrisma`. Quien escriba
F-010 y necesite un dato de `Negocio` dentro de esa transacción **debe** seguir pidiéndolo con un
`select` explícito con los mismos campos que necesite (nunca `tx.negocio.findUnique(...)` a secas,
aunque el tipo ancho de `qabPrisma` deje que compile): el `omit` real sigue activo y ese campo
saldrá `undefined` sin ningún aviso del compilador. Si F-010 —o cualquier feature posterior que use
`qabPrisma`— necesita leer varios campos de `Negocio` de forma habitual, la corrección de fondo (no
hecha aquí, para no reabrir un contrato ya cerrado) es que `arch-guardian` reevalúe si las firmas
de este contrato pueden tomar `PrismaClientLike` en vez de `Prisma.TransactionClient` a secas, lo
que permitiría a `qabPrisma` exportar el tipo estrecho sin romper nada.

**Acción de seguimiento:** este párrafo se cita también en las notas de `F-010` en
`.agents/features.json` para que no se descubra leyendo código.
