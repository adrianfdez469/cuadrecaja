# F-028 (PARTE B): `DEPENDENCY_FAILED_IN_BATCH` no gasta el contador de intentos

> Escrito por el agente `spec`. Cubre **únicamente la parte B** de F-028 — los criterios de
> aceptación **5 a 10** (reescritos en sitio el 2026-09-07, por decisión expresa del humano) más
> el **11**, aplicado a este camino. La parte A (cancelar `EXCHANGE_RATE` superados, criterios
> 1-4) está **cerrada y verificada**; su spec es `.agents/specs/F-028.md` y no se toca aquí.
> Contexto completo del reencuadre en `.agents/progress/F-028.md`, sección «PARTE B —
> desbloqueada el 2026-09-07».

## Qué hay que lograr

QAB ya construyó su F-037 (verificado en su código): cuando un evento de un lote falla, los
eventos **posteriores del mismo lote** que dependen de él vuelven también en `failed[]`, con
`error: "DEPENDENCY_FAILED_IN_BATCH"`. El evento arrastrado **nunca llegó a aplicarse** — ni bien
ni mal — y el contrato ordena reintentarlo **tal cual**, con su `payload.updatedAt` original.

Hoy, `planOutboxAck` (`src/lib/qab/outboxAck.ts`) no distingue: **toda** entrada de `failed[]`
entra en `failedAcks` y se le incrementa `intentos`, sin mirar el código de error. Eso significa
que cada arrastre gasta uno de los `QAB_OUTBOX_MAX_ATTEMPTS` (6) intentos de un evento que nunca
tuvo la culpa. Si la dependencia (un `CATEGORY`, una `CURRENCY`) tarda varias corridas en
resolverse, el dependiente agota sus intentos **por el solo hecho de esperar**, y
`claimOutboxBatch` (`src/lib/qab/outboxDrain.ts`) deja de tomarlo (`intentos < QAB_OUTBOX_MAX_ATTEMPTS`
en el `WHERE`). Un producto que hoy existe mal (sin categoría resuelta) pasaría a **no existir en
absoluto** en el escaparate.

El resultado esperado: una entrada de `failed[]` cuyo error es `DEPENDENCY_FAILED_IN_BATCH` se
trata como **«todavía no»**, no como **«mal»** — se reintenta en la corrida siguiente con su
`payload` intacto, y **no** cuenta contra su cupo de intentos.

**Qué NO arregla esta rodaja** (repetirlo donde corresponda, nunca como promesa absoluta — E-017):
esto no repara el producto que ya quedó huérfano porque su `CATEGORY` **agotó** sus intentos antes
de este cambio, ni ningún caso en que la dependencia nunca llegó a estar en el mismo lote. El
propio contrato lo escribe como su primer límite: la cascada es solo **dentro** del lote y solo
**hacia adelante** — una categoría que nunca llegó sigue dejando el producto con
`localCategoryId: NULL` para siempre, exactamente igual que antes de este feature. Reparar ese
residual exigiría fabricarle al dependiente un `payload.updatedAt` **nuevo**, que es justo lo
opuesto de lo que este feature hace, y queda fuera por decisión del humano del 2026-09-07.

## Alcance

**Incluye:**
- Que una entrada de `failed[]` con `error: "DEPENDENCY_FAILED_IN_BATCH"` no incremente `intentos`
  de la fila correspondiente, ni le toque `payload`, ni le toque `procesadoAt` (que sigue en
  `null`, la fila sigue pendiente).
- Que esto valga igual para las dos parejas que el contrato reconoce: `CATEGORY → PRODUCT` y
  `CURRENCY → EXCHANGE_RATE`.
- Que ninguna otra causa de `failed[]` cambie de comportamiento: solo este código de error se
  exime de gastar intento.
- Una función pura, testeable sin base de datos ni red, que clasifica una entrada de `failed[]`
  como «no gasta intento» a partir de la respuesta de QAB.
- Que el camino nuevo respete la regla de logs de la parte A: ni payload, ni token, ni cuerpo de
  error de QAB citados en ningún log, tampoco dentro de una excepción de runtime logueada.

**No incluye:**
- Reparar el producto (o la tasa) que quedó huérfano porque su dependencia **agotó** sus intentos
  antes de que la dependencia llegara a resolverse. Ese caso residual sigue sin red, a propósito.
- Fabricar un `payload.updatedAt` nuevo para ningún evento arrastrado, bajo ninguna circunstancia.
- Cualquier cambio en cómo se trata una dependencia que **nunca llega a estar en el mismo lote**
  que su dependiente — la cascada del contrato no cubre ese caso y este feature tampoco.
- Ninguna cota nueva y explícita al número de veces que un evento puede quedar exento de gastar
  intento (ver preguntas abiertas).

## Criterios de aceptación

Cada uno se verifica **ejecutando contra un servidor de captura local** — el mismo patrón que la
parte A: un servidor HTTP propio de la suite que responde lo que el test le programe y expone lo
que recibió. **Nunca contra QAB real.**

**5.** *"Con un CATEGORY y un PRODUCT que lo referencia en el mismo lote, un servidor de captura
que responde 207 con el CATEGORY en failed[] y el PRODUCT tambien en failed[] con
DEPENDENCY_FAILED_IN_BATCH deja las dos filas pendientes con su payload SIN TOCAR --el mismo
payload.updatedAt que tenian-- y el intentos del PRODUCT SIN incrementar. Verificado leyendo las
dos filas antes y despues de la corrida."*
- Se siembra un negocio con dos `OutboxEvento` en el mismo lote: un `CATEGORY` (id menor) y un
  `PRODUCT` (id mayor) que lo referencia, los dos con `procesadoAt` nulo e `intentos = 0`. El
  servidor de captura responde `207` con ambos en `failed[]`: el `CATEGORY` con cualquier error
  propio (uno que no sea `DEPENDENCY_FAILED_IN_BATCH`) y el `PRODUCT` con
  `DEPENDENCY_FAILED_IN_BATCH`. Se corre el drenaje. Se releen las dos filas: el `PRODUCT` sigue
  con `procesadoAt` nulo, `payload` byte a byte idéntico (mismo `updatedAt` incluido) e
  `intentos` en `0`, igual que antes de la corrida.

**6.** *"En la corrida siguiente, el CATEGORY pendiente viaja ANTES que el PRODUCT dentro de la
misma peticion. Verificado por el orden de los eventos que recibe el servidor de captura."*
- Sobre la misma siembra del criterio 5 (tras esa primera corrida, ninguna de las dos filas
  cambió de id), se corre el drenaje una segunda vez. Se lee el cuerpo que recibió el servidor de
  captura en esa segunda petición: el evento del `CATEGORY` aparece en una posición anterior a la
  del `PRODUCT` dentro de la misma lista `events`. Esto no exige lógica nueva de ordenamiento —
  ninguna de las dos filas fue reencolada ni cambió de id — así que el criterio verifica que este
  feature **no rompe** el orden que la emisión ya garantiza (F-006, criterios 11 y 13).

**7.** *"El intentos del CATEGORY SI se incrementa en cada corrida y al llegar a
QAB_OUTBOX_MAX_ATTEMPTS deja de tomarse; el del PRODUCT arrastrado sigue en cero por muchas veces
que se le arrastre. Verificado contando las corridas y leyendo las dos columnas. Desde ese punto
el PRODUCT viaja solo y se aplica con su categoria sin resolver: ese caso residual queda FUERA de
alcance por decision del humano (2026-09-07) y no se repara en este feature."*
- Sobre la misma pareja, se corre el drenaje `QAB_OUTBOX_MAX_ATTEMPTS` (6) veces, con el `CATEGORY`
  fallando con su propio error (no `DEPENDENCY_FAILED_IN_BATCH`) y el `PRODUCT` en
  `DEPENDENCY_FAILED_IN_BATCH` en cada una. Se lee `intentos` del `CATEGORY` tras cada corrida: sube
  de a uno (1, 2, 3, 4, 5, 6). Se lee `intentos` del `PRODUCT` tras cada corrida: se mantiene en 0
  las seis veces. Se corre una séptima vez: el `CATEGORY` ya no aparece en la petición que recibe
  el servidor de captura (excluido por `claimOutboxBatch`, cuyo `WHERE` exige
  `intentos < QAB_OUTBOX_MAX_ATTEMPTS`), y el `PRODUCT` **sí** aparece, viajando solo. No se
  verifica ni se exige nada sobre qué responde QAB para ese `PRODUCT` solitario — ese es
  precisamente el residual fuera de alcance.

**8.** *"Un CURRENCY en failed[] con su EXCHANGE_RATE arrastrado en failed[] con
DEPENDENCY_FAILED_IN_BATCH recibe el mismo trato: payload sin tocar e intentos sin gastar. La
pareja CURRENCY -> PRODUCT no se contempla, porque el contrato no la reconoce y el lado receptor
no la implementa."*
- Se repite el montaje del criterio 5 con la otra pareja: un `CURRENCY` y una `EXCHANGE_RATE` que
  lo referencia, en el mismo lote. El servidor de captura responde con el `CURRENCY` en `failed[]`
  con un error propio y la `EXCHANGE_RATE` en `failed[]` con `DEPENDENCY_FAILED_IN_BATCH`. Se
  corre el drenaje y se relee la `EXCHANGE_RATE`: `payload` idéntico, `intentos` sin incrementar.
  La segunda mitad del criterio (`CURRENCY -> PRODUCT` no se contempla) no exige un test negativo:
  la clasificación de este feature actúa **solo sobre el código de error que trae la entrada de
  `failed[]`**, sin razonar sobre qué entidad depende de cuál — es QAB quien decide, lote a lote,
  qué eventos cuentan como arrastrados, y el contrato ya declara que un `PRODUCT` no arrastra por
  `CURRENCY`. Basta con que la implementación no distinga por tipo de entidad al clasificar.

**9.** *"Ninguna otra entrada de failed[] deja de gastar intento por este cambio: verificado con
una corrida completamente exitosa (ningun intentos se mueve) y con otra que trae un fallo propio
de QAB, cuyo intentos SI se incrementa. Los dos casos en la misma verificacion, comparando la
columna de todas las filas del lote antes y despues."*
- Con un lote de varias filas: (a) una corrida donde el servidor de captura responde `ok` para
  todas — se comprueba que ninguna fila cambia su `intentos` (para las acusadas en `ok`, tampoco
  cambiaría de todos modos, por la tabla de verdad de ADR 0011: `intentos` no se toca en un `ok`).
  (b) una corrida donde una fila vuelve en `failed[]` con un error propio de QAB que **no** es
  `DEPENDENCY_FAILED_IN_BATCH` (por ejemplo `STORE_OPENING_HOURS_INVALID` u otro texto libre) — se
  comprueba que **esa** fila sí incrementa `intentos` en uno, exactamente como antes de este
  feature. Los dos casos se corren y se leen en la misma verificación, comparando la columna
  `intentos` de todas las filas del lote antes y después de cada corrida.

**10.** *"Clasificar una entrada de failed[] como 'no gasta intento' es una funcion PURA que
recibe la respuesta y devuelve la particion, con su test en src/__tests__/, sin base de datos y
sin red."*
- Se verifica que existe una función así en `src/`, con su archivo de test correspondiente en
  `src/__tests__/`. El test se ejecuta con `npx vitest run` y pasa sin ninguna conexión a
  Postgres ni ninguna llamada de red — mismo patrón que los tests ya existentes de
  `collectQabPermanentFailures` en `src/__tests__/outboxAck.test.ts`, que es la función más
  parecida a la que este criterio pide: pura, recibe `rows` y un `IQabPostOutcome`, devuelve algo
  derivado sin tocar el mundo exterior.

**11.** *"Ni el payload, ni el token del negocio, ni el cuerpo de error de QAB aparecen citados en
ningun log de este camino, tampoco dentro del mensaje de una excepcion de runtime que termine
logueada (E-031). El reencolado registra a lo sumo ids internos."* — aplicado aquí al camino de
**clasificación y reintento sin gasto de intentos**, que es el código nuevo de esta rodaja.
- Este es el criterio de mayor riesgo en esta parte, y por un motivo concreto: a diferencia de la
  parte A (que nunca leía el cuerpo de error de QAB), este código **inspecciona directamente
  `entry.error`** — un string que QAB controla por completo — para decidir si una fila gasta
  intento o no. Es la forma exacta de E-031: un mensaje fabricado a partir de un dato externo
  puede citarlo. Se verifica sembrando una entrada de `failed[]` cuyo `error` lleva una cadena
  marcadora reconocible (mucho más larga que `"DEPENDENCY_FAILED_IN_BATCH"`, para que ninguna
  comparación exacta ni ningún `includes` la confunda con el código real) junto con un `payload` y
  un token de negocio que también llevan sus propias cadenas marcadoras. Se fuerza además una vía
  de excepción de runtime real dentro de la clasificación o del camino que la usa (por ejemplo,
  un fallo al truncar o comparar ese string, o una excepción que involucre el valor de `entry.error`
  de alguna forma). Se revisa el texto completo de todo log o excepción que termine registrada en
  este camino: ninguna de las tres cadenas marcadoras aparece, ni como fragmento. Como mucho
  aparecen ids internos (`id` de la fila, `negocioId`, `entidadId`) y, si se decide loguear el
  código de error en sí (`DEPENDENCY_FAILED_IN_BATCH` es un valor cerrado y conocido del contrato,
  no un fragmento de texto libre), eso no cuenta como "cuerpo de error de QAB" en el sentido que
  este criterio prohíbe — pero cualquier otro fragmento del `error` recibido, si no es exactamente
  ese código cerrado, sí lo es y no puede aparecer.

## Contexto necesario

Material verificado abriendo cada archivo — todas las referencias que me dieron cuadran con el
código real, no encontré ninguna cita equivocada esta vez (a diferencia de la parte A, que sí
tuvo una):

- **`planOutboxAck`** (`src/lib/qab/outboxAck.ts:95-133`) es donde hoy toda entrada de `failed[]`
  entra en `failedAcks` (línea 117-124) sin mirar `entry.error` más que para el mensaje. No
  distingue ningún código.
- **`collectQabPermanentFailures`** (`src/lib/qab/outboxAck.ts:144-174`) es la función más parecida
  a la que pide el criterio 10: pura, recibe `rows` y un `IQabPostOutcome`, clasifica entradas de
  `failed[]` por código contra una lista cerrada (`QAB_OUTBOX_PERMANENT_ERROR_CODES`), e **ignora**
  cualquier `intentos++` — «no cambia nada de la mecánica de reintento», dice su docstring. Es el
  patrón a seguir, no a reutilizar tal cual: esa función solo **reporta** para visibilidad, nunca
  saca filas de `failedAcks`; este feature sí necesita sacar filas de esa lista.
- **`QAB_OUTBOX_MAX_ATTEMPTS = 6`** y **`QAB_OUTBOX_ERROR_CODES`** (`src/constants/qab.ts:37,
  89-96`) — el corte y los prefijos (`TRANSPORT`, `HTTP`, `EVENT`, `MISSING_IN_RESPONSE`,
  `INVALID_RESPONSE_BODY`, `QAB_TOKEN_MISSING`) que hoy existen. Ninguno de los seis representa
  «no gasta intento»: los seis son formas de fallo que sí cuentan.
- **`QAB_OUTBOX_PERMANENT_ERROR_CODES`** (`src/constants/qab.ts:221-225`) tiene hoy tres códigos,
  ninguno es `DEPENDENCY_FAILED_IN_BATCH` — correctamente, porque el fallo no es permanente (se
  resuelve solo cuando la dependencia entra). Pero **"no permanente" y "no gasta intento" son dos
  clasificaciones distintas** y hoy solo existe la primera: no hay ninguna lista ni función que
  represente la segunda. Que quien diseñe esto no las confunda ni las junte en la misma lista sin
  pensarlo — un código puede ser no-permanente y aun así seguir gastando intento (los seis de
  `QAB_OUTBOX_ERROR_CODES` lo son), y viceversa no aplica hoy pero podría en el futuro.
- **`claimOutboxBatch`** (`src/lib/qab/outboxDrain.ts:69-96`) es el `WHERE` que excluye una fila
  cuando `intentos >= QAB_OUTBOX_MAX_ATTEMPTS` (línea 73). Es el mecanismo que hace que el
  criterio 7 se cumpla al llegar a 6: el `CATEGORY` deja de tomarse, no porque algo nuevo lo frene,
  sino porque ya existía esa guarda desde F-002.
- **`drainQabOutbox`** (`src/lib/qab/outboxDrain.ts:137-261`) es donde `planOutboxAck` se invoca
  (línea 201) y donde el resultado se escribe: `processedIds` con un `updateMany` (línea 223-228)
  y `failedAcks` agrupados por mensaje con otro `updateMany` que incrementa `intentos` (línea
  230-243). Una fila que no aparece en ninguna de las dos listas —como ya pasa hoy con
  `skipped_no_token` o `skipped_deadline`— **no se toca en absoluto**: ni `procesadoAt`, ni
  `intentos`, ni `ultimoError`. Ese es exactamente el efecto que los criterios 5 y 8 piden para una
  entrada `DEPENDENCY_FAILED_IN_BATCH`, y ya existe un patrón en este mismo archivo (líneas
  172-197) para dejar filas intactas sin gastarles intento.
- **`IQabOutboxAckPlan`** (`src/schemas/qabSync.ts:39-44`) hoy solo tiene `processedIds` y
  `failedAcks` — dos listas, no tres. No hay hoy ningún lugar donde representar «esta fila se deja
  tal cual, sin ack de ningún tipo». Es una decisión de diseño del arquitecto si esto se resuelve
  ampliando el tipo, o filtrando antes de construirlo, o de otra forma.
- **ADR 0011** (`docs/adr/0011-reintentos-del-outbox-sin-backoff.md`), tabla de verdad
  **vinculante** (líneas 42-51): fija qué le pasa a `procesadoAt`, `intentos` y `ultimoError` en
  cada caso hoy conocido. Ninguna fila de esa tabla contempla `DEPENDENCY_FAILED_IN_BATCH` — es
  un caso nuevo que la tabla no cubre todavía, y el propio ADR ya lo señala como filo abierto (su
  sección de contras, sobre un corte de QAB que se lleva por delante lo pendiente en bloque, es el
  mismo tipo de riesgo que este feature ataca desde otro ángulo). Corresponde al arquitecto decidir
  si esta fila nueva se añade a esa tabla o si merece un ADR propio — probablemente lo segundo,
  dado que cambia el contrato interno de `planOutboxAck`.
- **`qabOutboxLog.ts`** (`src/lib/qab/qabOutboxLog.ts`) ya tiene el patrón exacto que el criterio
  11 exige: cada logueador de este archivo cita solo ids y códigos cerrados, nunca payload ni
  token (ver por ejemplo `logQabPermanentFailure`, líneas 23-27, y su docstring "no store name, no
  payload, no response body"). Si esta rodaja añade un logueador nuevo (por ejemplo, para hacer
  visible cuántas filas quedaron exentas de gastar intento en una corrida, análogo a como
  `collectQabPermanentFailures` se hace visible con `logQabPermanentFailure`), debe seguir el
  mismo patrón.
- **Las dos parejas de dependencia son exactamente dos**, según el contrato v12.1
  (`sync-contract.md`, § «Cambios respecto a la v10.1» ③): `CATEGORY → PRODUCT` (por
  `localCategoryId`) y `CURRENCY → EXCHANGE_RATE` (por `code` de moneda). El propio contrato aclara
  que `CURRENCY` no arrastra a `PRODUCT` porque un `PRODUCT` guarda el código de moneda sin clave
  ajena — no es un olvido, es un recorte deliberado de S-006. Verificado también en
  `qabCatalogEmission.ts` y `qabCatalogEmitters.ts`: el `entidadId` de un `CATEGORY` es
  `categoriaId` (`qabCatalogEmission.ts:214-215, 276-277`) y el de un `PRODUCT` es
  `productoTiendaId` (`qabCatalogEmission.ts:230-231`) — no hay coincidencia de `entidadId` entre
  ambos, así que la relación de dependencia vive en el `payload` (`localCategoryId`), no en la
  clave del outbox. Esto no cambia nada de lo que este feature construye —la clasificación actúa
  solo sobre el código de `failed[]`, nunca sobre la relación entre entidades— pero es contexto
  útil para quien diseñe el logueador o los tests: no hay forma de, desde este código, verificar
  *qué* dependencia causó el arrastre, solo *que* QAB dijo que fue un arrastre.
- **Servidor de captura**: mismo patrón de la parte A y de F-012/F-014/F-021 — servidor HTTP local
  de la suite, sin helper específico ya escrito para este drenaje en `src/__tests__/`.

## Preguntas abiertas (para el arquitecto, paso 4)

Esta tensión la detecta el spec pero **no la resuelve** — es diseño técnico y probablemente merece
su propio ADR:

1. **¿Qué detiene un reintento indefinido de una fila que nunca gasta intento?** ADR 0011 fijó el
   corte de 6 explícitamente como guarda de bloqueo de cabeza de línea. Una fila que "no gasta
   intento" puede, en principio, reintentarse sin límite. El dato que acota esto, verificado en
   `claimOutboxBatch`: en la práctica, la cascada solo ocurre mientras la dependencia (el
   `CATEGORY` o el `CURRENCY`) siga viajando en el mismo lote, y esa dependencia **sí** gasta sus
   propios intentos con la mecánica sin cambios — así que cuando la dependencia agota los suyos
   (6, por `claimOutboxBatch`), deja de ser tomada, deja de aparecer en el lote, y la cascada deja
   de producirse: el dependiente pasa a viajar solo (ver criterio 7). **No decido aquí si ese
   límite implícito basta** como la guarda que ADR 0011 exige, o si hace falta una cota explícita
   y propia para el dependiente (por ejemplo, un número máximo de veces que una fila puede quedar
   exenta antes de que se le empiece a contar igual que cualquier otro fallo). Argumentos en ambas
   direcciones que el arquitecto tendrá que sopesar: a favor de confiar en el límite implícito, es
   simple y ya existe; en contra, depende enteramente de que la clasificación nunca se equivoque al
   identificar qué es y qué no es un arrastre genuino de *ese* lote — un error de clasificación (o
   un cambio futuro de QAB que emita el código en un caso que no es una cascada real) rompería la
   cota sin que nada lo avise.

---

# Contrato de interfaces

> Escrito por el agente `arch-guardian` (paso 4). Todo lo que hay **encima** de esta línea es del
> agente `spec` y no se ha tocado. `implementer` (escribe `src/**`) y `dev-tester` (escribe
> `src/__tests__/**`) programan contra esta sección **sin verse entre ellos**: lo que no esté fijado
> aquí, divergirá.

## 0. Las dos decisiones, y dónde están razonadas

| Pregunta | Decisión |
|---|---|
| ¿Qué forma tiene el tercer estado, dado que `IQabOutboxAckPlan` solo tiene dos listas? | **Una tercera lista en el plan**, `deferrals`. Es una **disposición en memoria**, no un estado de la fila: su efecto entero sobre la base de datos es **la ausencia de escritura**. Cero columnas, cero migración |
| ¿Qué detiene un reintento indefinido de una fila que ya no gasta intento? | **La propia dependencia**, sin cota nueva. Un arrastrado, por construcción, **nunca es la cabeza de la línea**: siempre hay en su mismo lote una fila de `id` menor que falló por su cuenta y que **sí** está gobernada por el corte de 6. La guarda contra el silencio es la **visibilidad**, no un contador |
| ¿Qué pasa con `ultimoError` en el caso nuevo? | **No se escribe.** La fila queda entera como estaba. El motivo pesa: `buildStoreSyncState` clasifica por `ultimoError`, así que escribirlo haría que la pantalla dijera `FAILED` de un evento correcto |

**ADR emitidos:**

- [`docs/adr/0102-un-arrastre-de-dependencia-es-una-tercera-disposicion-del-acuse-no-un-estado-de-la-fila.md`](../../docs/adr/0102-un-arrastre-de-dependencia-es-una-tercera-disposicion-del-acuse-no-un-estado-de-la-fila.md)
  — el **qué**: la tercera disposición, la séptima fila que se añade a la tabla vinculante del
  ADR 0011, el censo recorrido (el acuse + los veintidós accesos a `OutboxEvento`), por qué
  `ultimoError` no se escribe, y **por qué aquí sí hace falta vocabulario nuevo y en el ADR 0100
  no**.
- [`docs/adr/0103-el-arrastre-se-clasifica-por-igualdad-exacta-y-no-lleva-cota-propia.md`](../../docs/adr/0103-el-arrastre-se-clasifica-por-igualdad-exacta-y-no-lleva-cota-propia.md)
  — el **cómo**: igualdad exacta contra una lista cerrada propia (nunca `includes`), la demostración
  de que la cabeza de línea no se bloquea, y por qué no hay cota explícita.

El ADR 0011 lleva desde hoy una nota bajo su tabla que remite al ADR 0102: la tabla **ya no era
completa** para el mundo de la v11, y una tabla vinculante incompleta que se lee como completa es
el peor de los dos males.

**En caso de contradicción entre este contrato y un ADR, gana el ADR** (E-030). Si encuentras una,
no la resuelvas por tu cuenta: devuélvela al `arch-guardian`.

## 1. Migración de Prisma: NINGUNA

**Este feature no cambia `prisma/schema.prisma`, no crea columnas, no crea índices y no crea
ninguna migración.** No hay nombre de migración que fijar y **nadie la crea** — ni el arquitecto, ni
el `implementer`. Es una consecuencia directa del ADR 0102 y no una omisión: el estado nuevo vive en
un objeto de una función pura y su efecto sobre la tabla es no escribir nada.

- **E-052 no aplica**: no hay que tocar el schema, así que **no se ejecuta `npx prisma format`** en
  ningún momento.
- **E-004 no aplica**: no hay `prisma migrate dev --create-only` en este feature.
- **E-002 al revés**: no hace falta `npx prisma generate` ni reiniciar el dev server. **Si al
  implementar o al verificar aparece la necesidad de regenerar el cliente de Prisma, eso es la señal
  de que algo se ha desviado de este contrato** — para y devuélvelo al `arch-guardian`.

## 2. Archivos

| Archivo | Acción | Dueño |
|---|---|---|
| `src/constants/qab.ts` | modificado — dos constantes nuevas al final, en su propia sección `F-028 (part B)` | `implementer` |
| `src/schemas/qabSync.ts` | modificado — un schema nuevo, dos tipos derivados y un campo nuevo en dos schemas existentes | `implementer` |
| `src/lib/qab/outboxAck.ts` | modificado — una función pura nueva, `planOutboxAck` con tres listas, `emptyQabOutboxDrainReport` con un campo más | `implementer` |
| `src/lib/qab/qabOutboxLog.ts` | modificado — un logueador nuevo | `implementer` |
| `src/lib/qab/outboxDrain.ts` | modificado — recoger, loguear y reportar `plan.deferrals`, y **no** escribirlos | `implementer` |
| `src/__tests__/outboxAck.test.ts` | modificado — casos nuevos **y tres aserciones preexistentes que hay que actualizar** (§ 11.3) | `dev-tester` |
| `src/__tests__/qabSync.test.ts` | modificado — el schema nuevo, el campo nuevo, y una aserción preexistente (§ 11.3) | `dev-tester` |
| `src/__tests__/qabOutboxLog.test.ts` | modificado — el logueador nuevo, en un `describe` propio | `dev-tester` |

Ningún otro archivo de `src/` se toca. En particular **no se tocan** `src/lib/qab/outboxCancel.ts`
(parte A), `outboxEnqueue.ts`, `outboxPurge.ts`, `qabCatalogClient.ts`, `qabCatalogOutboxFilters.ts`,
`qabProductSyncState.ts`, `qabStoreSyncState.ts`, `qabAvailabilityQuery.ts`, `syncTiendaCron.ts` ni
ninguna ruta de `src/app/`. El censo del ADR 0102 explica sitio por sitio por qué ninguno necesita
cambiar.

## 3. Constantes — `src/constants/qab.ts`

Al **final** del archivo, con su propio encabezado al estilo de los que ya hay:

```ts
/* -------------------------------------------------------------------------- */
/* F-028 (part B) — Failures QAB attributes to another event of the same batch */
/* -------------------------------------------------------------------------- */

/**
 * Errors that mean "not yet", not "wrong": the event never got applied, so it is
 * retried UNCHANGED and does NOT spend one of QAB_OUTBOX_MAX_ATTEMPTS. Matched by
 * EXACT equality, never by substring - see ADR 0103 § 1.
 *
 * This is a DIFFERENT classification from QAB_OUTBOX_PERMANENT_ERROR_CODES: "not
 * permanent" and "does not count" are not the same thing, and every code in
 * QAB_OUTBOX_ERROR_CODES is an example of one that is not permanent and still
 * counts.
 */
export const QAB_OUTBOX_DEFERRED_ERROR_CODES = ["DEPENDENCY_FAILED_IN_BATCH"] as const;

/** Log prefix of one deferred event. Ids and the closed code only. */
export const QAB_OUTBOX_DEFERRED_LOG = "qab.outbox.deferred";
```

`QAB_OUTBOX_PERMANENT_ERROR_CODES` **no se toca**: el código nuevo no entra en esa lista, y
`collectQabPermanentFailures` sigue exactamente como está.

## 4. Schemas — `src/schemas/qabSync.ts`

Nada se escribe a mano: los dos tipos salen de `z.infer`, y el segundo se deriva del primero.

```ts
/**
 * One event QAB reported in `failed[]` blaming ANOTHER event of the same batch.
 * Sibling of `qabPermanentFailureSchema`, and its opposite in the two dimensions
 * that matter: this one is not permanent AND does not spend an attempt. Reported
 * because the row itself records nothing (ADR 0102).
 */
export const qabOutboxDeferralSchema = z.object({
  eventId: z.string().min(1),
  negocioId: z.string().min(1),
  entidad: qabOutboxEntitySchema,
  entidadId: z.string().min(1),
  /** The member of the closed list that matched. NEVER the received string. */
  code: z.enum(QAB_OUTBOX_DEFERRED_ERROR_CODES),
});
export type IQabOutboxDeferral = z.infer<typeof qabOutboxDeferralSchema>;
export type IQabOutboxDeferralCode = IQabOutboxDeferral["code"];
```

`QAB_OUTBOX_DEFERRED_ERROR_CODES` se añade al `import` que este módulo ya hace de
`@/constants/qab`. No se crea ningún módulo de schemas nuevo: una arista de valor de vuelta cerraría
un ciclo, que es E-028.

**El campo nuevo en los dos schemas existentes**, en las dos posiciones exactas:

```ts
export const qabOutboxAckPlanSchema = z.object({
  processedIds: z.array(z.string()),
  failedAcks: z.array(z.object({ id: z.string(), ultimoError: z.string() })),
  /** Rows to leave EXACTLY as they are: no ack, no attempt spent (ADR 0102). */
  deferrals: z.array(qabOutboxDeferralSchema).default([]),
});
```

```ts
// inside qabOutboxDrainReportSchema, right after `permanentFailures`
  /** Events QAB blamed on another event of the same batch. Not counted as `failed`. */
  deferrals: z.array(qabOutboxDeferralSchema).default([]),
```

`.default([])` y no un campo obligatorio, por el mismo motivo que `permanentFailures` y
`appliedStoreEvents`: un cuerpo antiguo sigue validando. Ojo a la consecuencia de tipos: con
`.default([])` el tipo de **salida** lleva la clave obligatoria, así que todo objeto construido en
TypeScript **tiene que** incluirla — de ahí § 11.3.

## 5. `src/lib/qab/outboxAck.ts` — firmas exactas

### 5.1 La clasificación pura (criterio 10)

```ts
/**
 * PURE. The member of QAB_OUTBOX_DEFERRED_ERROR_CODES that `error` is EXACTLY
 * equal to, or `undefined`. Case sensitive, no trimming, no substring search and
 * no normalisation: see ADR 0103 § 1 for why this is narrower than the match
 * `collectQabPermanentFailures` does, on purpose.
 *
 * It returns the CONSTANT and not the received string, so nothing QAB controls
 * travels any further than this comparison. Never throws: `===` between two
 * strings has no failure mode, and this function does no parsing, no truncation
 * and no interpolation (E-031).
 */
export function matchQabOutboxDeferralCode(error: string): IQabOutboxDeferralCode | undefined;
```

Casos borde, fijados aquí para que implementación y tests no puedan divergir:

| `error` | Devuelve |
|---|---|
| `"DEPENDENCY_FAILED_IN_BATCH"` | ese miembro de la lista |
| `"dependency_failed_in_batch"` | `undefined` — sensible a mayúsculas |
| `" DEPENDENCY_FAILED_IN_BATCH "` | `undefined` — no se hace `trim` |
| `"EVENT:DEPENDENCY_FAILED_IN_BATCH"` | `undefined` — no se busca subcadena |
| `"DEPENDENCY_FAILED_IN_BATCH y algo más"` | `undefined` |
| `""` | `undefined` |
| `"STORE_OPENING_HOURS_INVALID"` u otro texto libre de QAB | `undefined` |

### 5.2 `planOutboxAck` — la partición pasa de dos listas a tres

La firma **no cambia**. Cambia su docstring y su valor de retorno:

```ts
/**
 * What to write back, given what was sent and what came back. Pure and total:
 * every row of `rows` appears in exactly ONE of the THREE lists, in the given
 * order. Ids in `outcome` that do not belong to `rows` are IGNORED - QAB can
 * never make this run acknowledge a row it did not send.
 *
 * The third list, `deferrals`, is the one the caller writes NOTHING for: no
 * `procesadoAt`, no `intentos`, no `ultimoError`. It is the seventh row of the
 * truth table of ADR 0011, added by ADR 0102; the other six are unchanged and
 * are not restated here.
 */
export function planOutboxAck(rows: IOutboxEvento[], outcome: IQabPostOutcome): IQabOutboxAckPlan;
```

**El orden de las comprobaciones por fila, que es parte del contrato:**

1. `outcome.kind === "error"` → todas las filas a `failedAcks` como hoy, y `deferrals: []`. Motivo:
   un fallo de transporte o de HTTP no es atribuible a un evento; el lote no obtuvo respuesta, así
   que nada de él se sabe arrastrado. Es el mismo razonamiento que `collectQabPermanentFailures`
   tiene escrito en su propio código para su retorno temprano — se remite a él, no se reescribe
   (E-039).
2. El `Map` de fallos se construye **exactamente como hoy**, desde `outcome.response.failed`. Su
   semántica ante un id repetido no cambia: **gana la última entrada**.
3. Si hay entrada de `failed` para la fila y `matchQabOutboxDeferralCode(...) !== undefined` →
   `deferrals`.
4. Si hay entrada de `failed` y no casa → `failedAcks` con
   `EVENT:<error>` truncado, **igual que hoy**.
5. Si el id está en `ok` → `processedIds`, igual que hoy.
6. Si no está en ninguna → `failedAcks` con `MISSING_IN_RESPONSE`, igual que hoy.

**La entrada de `deferrals` se construye desde la FILA LOCAL, nunca desde la respuesta:**

```ts
deferrals.push({
  eventId: row.id,
  negocioId: row.negocioId,
  entidad: row.entidad,
  entidadId: row.entidadId,
  code,
});
```

Tabla de decisión completa, criterio 9 incluido:

| Lo que trae la respuesta para la fila | Lista | Qué se escribe en la fila |
|---|---|---|
| El id en `ok` | `processedIds` | `procesadoAt = now()`, `ultimoError = null` |
| El id en `failed` con el código exacto de arrastre | `deferrals` | **nada** |
| El id en `failed` con cualquier otro `error` | `failedAcks` | `intentos + 1`, `EVENT:<error>` |
| El id en `failed` con el código como subcadena, en otra caja, o con espacios alrededor | `failedAcks` | `intentos + 1`, `EVENT:<error>` |
| El id en `ok` **y** en `failed` con el código de arrastre | `deferrals` | **nada** — el `failed` sigue mandando sobre el `ok`, como hoy, y aquí eso además es lo seguro: el contrato dice que un arrastrado no se aplicó |
| El id en `ok` **y** en `failed` con otro error | `failedAcks` | `intentos + 1` — sin cambio |
| Dos entradas de `failed` para el mismo id, la última con el código de arrastre | `deferrals` | **nada** — gana la última, como hoy |
| Dos entradas de `failed` para el mismo id, la última con otro error | `failedAcks` | `intentos + 1` — gana la última, como hoy |
| El id en ninguna de las dos listas | `failedAcks` | `intentos + 1`, `MISSING_IN_RESPONSE` |
| `outcome.kind === "error"` | todas a `failedAcks` | `intentos + 1`, `TRANSPORT:…` / `HTTP:…` |
| Un id de `failed` que **no** está en `rows` | ignorado | nada |
| `rows: []` | las tres vacías | nada |

### 5.3 `emptyQabOutboxDrainReport`

Un campo más, por el campo nuevo del informe. La firma no cambia:

```ts
    permanentFailures: [],
    deferrals: [],
    appliedStoreEvents: [],
```

## 6. El logueador — `src/lib/qab/qabOutboxLog.ts`

Calcado de `logQabPermanentFailure`, que ya vive en ese archivo, con el mismo orden de campos:

```ts
/**
 * One line per deferred event. Ids and the CLOSED code only: no payload, no
 * business token, no QAB response body - same rule as `logQabPermanentFailure`.
 * `code` comes from `IQabOutboxDeferral`, which carries the constant that
 * matched and never the received string (ADR 0103 § 1).
 * `qab.outbox.deferred entidad=PRODUCT entidadId=<id> negocioId=<id> code=<code> eventId=<id>`
 *
 * `warn` and not `error`: a deferral is not a failure of this event, it is a
 * backlog waiting for its dependency - the same reading `logQabWithheldOutbox`
 * gives a backlog waiting for a switch. And not `info` either: it is not routine.
 */
export function logQabOutboxDeferral(deferral: IQabOutboxDeferral): void;
```

El prefijo sale de `QAB_OUTBOX_DEFERRED_LOG`, nunca de un literal suelto. **Una línea por arrastre y
por corrida**, igual que `logQabPermanentFailure`: en el caso patológico ese ruido *es* la señal
(ADR 0103 § 2).

## 7. `src/lib/qab/outboxDrain.ts` — los cambios exactos

Tres, y ninguno más en ese archivo.

1. **Un acumulador**, junto a `permanentFailures`:

```ts
      const deferrals: IQabOutboxDeferral[] = [];
```

2. **Recoger y loguear**, inmediatamente **después** del bucle de
   `collectQabPermanentFailures` y **antes** de los `processedIds.push(...)`, para que los dos
   canales de visibilidad queden juntos:

```ts
        // Left EXACTLY as they are: no `procesadoAt`, no `intentos++`, no
        // `ultimoError`. The row records nothing, so the log and the report are
        // the only places a deferral is visible (ADR 0102).
        for (const deferral of plan.deferrals) {
          logQabOutboxDeferral(deferral);
          deferrals.push(deferral);
        }
```

3. **El campo del informe**, junto a `permanentFailures`:

```ts
        permanentFailures,
        deferrals,
```

**Lo que NO se toca, y es la mitad del contrato:**

- `plan.deferrals` **no se suma** a `processedIds` ni a `failedAcks`. Los dos `updateMany` quedan
  literalmente como están: una fila arrastrada no entra en ninguno, así que **no recibe ninguna
  escritura**. Es el mismo efecto que ya tienen hoy un grupo `skipped_deadline` y las entidades
  retenidas de ADR 0092 — filas que quedan intactas. La diferencia, y por eso hacía falta la tercera
  lista, es que esas **nunca se enviaron**, así que nunca llegan a `planOutboxAck`.
- `claimOutboxBatch` no cambia. El criterio 6 (la dependencia viaja antes que el dependiente en la
  corrida siguiente) **no necesita lógica nueva**: ninguna de las dos filas se reencola ni cambia de
  `id`, y el `ORDER BY o.id` ya existente lo garantiza. El criterio verifica que este feature **no
  rompe** ese orden.
- `byBusiness` no gana ningún campo. `failed: plan.failedAcks.length` sigue igual, así que **un
  arrastrado no cuenta como `failed`** ni en el contador del negocio ni en el global: la exclusión
  es estructural, no una resta. Que `processed + failed < events` ya era posible antes de este
  feature (un grupo `skipped_deadline` deja los dos a cero con `events > 0`), así que ningún
  consumidor podía estar apoyándose en esa igualdad. La agregación por negocio, si algún día hace
  falta, se deriva del `negocioId` que cada entrada de `deferrals` ya lleva.
- El retorno temprano de la reclamación vacía, `{ ...emptyQabOutboxDrainReport(), withheld }`,
  **no cambia**: la factoría ya trae `deferrals: []`.

## 8. Aislamiento multi-tenant

Este feature **no abre ninguna consulta nueva, no modifica ningún `WHERE` y no toca ninguna guarda
de autenticación ni de permisos**. Aun así hay dos propiedades que sostener y que el `implementer`
no puede relajar:

| Propiedad | Cómo se sostiene |
|---|---|
| Una respuesta de QAB no puede cambiar la disposición de una fila de otro negocio | `planOutboxAck` recorre `rows` —lo que **esta** corrida envió— y busca en la respuesta por id. Un id de `failed` que no está en `rows` se ignora, y eso **no cambia**. El ADR 0011 ya registra esta propiedad como comprobable en un test unitario sin base de datos |
| Los datos de un arrastre salen de la fila local | `eventId`, `negocioId`, `entidad` y `entidadId` se leen de `row`. De la respuesta solo se lee el **código**, y lo que se propaga es la constante propia que casó |

`toQabCatalogBatch` sigue lanzando `QabTenantMismatchError` ante una fila de otro negocio: no se
toca.

## 9. Criterio 11 — qué se loguea exactamente, y qué se valida

**Lo único que este camino escribe en un log** es la línea de § 6, con el helper
`logQabOutboxDeferral`. No se añade ningún `console.*` suelto en `outboxAck.ts` ni en
`outboxDrain.ts`, y **no se inventa ningún logueador nuevo**: el archivo de logs es
`src/lib/qab/qabOutboxLog.ts` y ya tiene el patrón.

Qué aparece en esa línea, campo por campo: `entidad` y `entidadId` de la fila local, `negocioId` de
la fila local, `eventId` (el `OutboxEvento.id`) y `code`, que es **el miembro de
`QAB_OUTBOX_DEFERRED_ERROR_CODES`**, no el `entry.error` recibido. El spec autoriza expresamente
esos: «Como mucho aparecen ids internos (`id` de la fila, `negocioId`, `entidadId`) y, si se decide
loguear el código de error en sí […] eso no cuenta como "cuerpo de error de QAB"».

**Entrada externa.** `entry.error` es una cadena que QAB controla por completo. Ya llega validada:
`qabCatalogSyncResponseSchema` la declara `z.string()` y `postQabCatalogBatch` valida el cuerpo del
207 antes de devolverlo. **No se revalida aquí** —se confía en la frontera que ya existe, la misma
política que `claimOutboxBatch` declara para las filas— y lo único que se hace con ella es `===`.

Y lo que sostiene el criterio es lo que este camino **no** hace. Cinco hechos comprobables, ninguno
un absoluto sobre código que no existe:

1. **La cadena recibida muere en la comparación.** No se trunca (no pasa por
   `truncateOutboxError`), no se interpola en ningún mensaje, no se guarda en ninguna columna y no
   llega a ningún log. Un arrastrado no escribe `ultimoError`, que es la única columna donde el
   texto de QAB podría acabar.
2. **No hay `JSON.parse`, no hay `BigInt(<cadena>)` y no hay `Number()`** en el código nuevo. Son
   las vías que E-031 documenta para que el runtime fabrique un mensaje **citando el dato que lo
   rompió**, y E-031 llegó a tres apariciones precisamente por ahí.
3. **`===` entre dos cadenas no tiene modo de fallo**, así que la clasificación no tiene rama de
   excepción propia. Tampoco hay `catch` nuevo en ninguno de los dos archivos.
4. **El código nuevo no toca `payload`.** `planOutboxAck` ya recibe filas con `payload`, pero la
   construcción de una entrada de `deferrals` lee cinco campos y `payload` no es uno.
5. **El código nuevo no toca el token.** No consulta `Negocio` y `loadQabTokens` no se modifica.

**Nota para quien verifique el criterio 11.** El spec propone forzar «una excepción de runtime real
dentro de la clasificación o del camino que la usa (por ejemplo, un fallo al truncar o comparar ese
string)». Con este diseño **ese camino no existe**: no se trunca y `===` no lanza. Eso **no exime**
de verificar el criterio, cambia cómo se verifica — el mismo patrón que la parte A, § 6 de
`.agents/specs/F-028.md`:

- Sembrar una entrada de `failed[]` cuyo `error` lleve una cadena marcadora reconocible, **más
  larga** que el código real y que **no lo contenga**, junto con un `payload` con su propia marca y
  un `qabToken` de negocio con la tercera. Correr el drenaje real y capturar los cuatro canales de
  `console`: ninguna de las tres marcas aparece, ni como fragmento.
- Forzar además una excepción de runtime **real** por una vía que sí existe: que el `updateMany` de
  fallos rechace (por ejemplo con una fila cuyo `ultimoError` no quepa, o interviniendo el `tx`), y
  revisar el texto completo de lo que acabe logueado, **con su stack**. Ese camino es el que
  manipula la cadena de QAB, porque `EVENT:<error>` sí llega a la base para una entrada **no**
  arrastrada — es la vía por la que el marcador podría salir, y es exactamente el comportamiento de
  hoy, que este feature no cambia.
- **Control positivo obligatorio** (E-008, E-056): una ausencia solo es evidencia si se demuestra
  que el instrumento habría visto la presencia. Comprobar en la misma verificación que la marca
  **sí** aparece cuando se loguea a propósito. Y **no** forzar el fallo con un `statement_timeout`:
  es una carrera que en la base local se pierde y la ausencia medida sale falsa (E-056, registrado
  en la parte A de este mismo feature).

## 10. Contratos de API

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| — | — | — | — |

**Este feature no añade, no quita y no cambia ningún endpoint.** El cron de sincronización
(`syncTiendaCron`) conserva su forma; lo único que crece es el informe que devuelve, con un array
`deferrals` que por defecto es `[]`.

## 11. Lista de testabilidad — completa y cerrada

F-028 parte B **no toca UI**: no hay pantalla, formulario ni diálogo, así que **no hay paso 4b** que
añada símbolos después de este contrato. La lista se cierra aquí, recorriendo el diseño entero y no
de memoria (E-035).

### 11.1 Puros — importables desde un test **sin base de datos y sin red**

| Símbolo | Archivo | Nota |
|---|---|---|
| `matchQabOutboxDeferralCode` | `src/lib/qab/outboxAck.ts` | Puro total. **Es la clasificación que pide el criterio 10** |
| `planOutboxAck` | `src/lib/qab/outboxAck.ts` | Puro total. **Es la partición que pide el criterio 10**: recibe la respuesta y devuelve las tres listas |
| `emptyQabOutboxDrainReport` | `src/lib/qab/outboxAck.ts` | Factoría pura |
| `logQabOutboxDeferral` | `src/lib/qab/qabOutboxLog.ts` | Sin base de datos ni red; escribe en `console`, así que se prueba con un espía, igual que los otros cinco logueadores de ese archivo |
| `qabOutboxDeferralSchema` | `src/schemas/qabSync.ts` | Schema |
| `qabOutboxAckPlanSchema` | `src/schemas/qabSync.ts` | Schema, con el campo nuevo |
| `qabOutboxDrainReportSchema` | `src/schemas/qabSync.ts` | Schema, con el campo nuevo |
| `QAB_OUTBOX_DEFERRED_ERROR_CODES` | `src/constants/qab.ts` | Constante |
| `QAB_OUTBOX_DEFERRED_LOG` | `src/constants/qab.ts` | Constante |

`IQabOutboxDeferral` e `IQabOutboxDeferralCode` son solo tipos: se importan con `import type` y no
se prueban.

**Un test que NO se escribe, a propósito:** ninguno que fije el contenido de
`QAB_OUTBOX_DEFERRED_ERROR_CODES` a `["DEPENDENCY_FAILED_IN_BATCH"]` como aserción de negocio. El
valor sale del contrato de QAB y puede crecer; un test que lo clave se pondría rojo el día que
crezca, que es lo contrario de lo que la suite debe proteger. Es la misma decisión que
`qabOutboxWithheld.test.ts` documenta para `QAB_OUTBOX_WITHHELD_ENTITIES`. Sí se puede usar la
constante como **entrada** de un caso (`matchQabOutboxDeferralCode(QAB_OUTBOX_DEFERRED_ERROR_CODES[0])`).

### 11.2 Necesitan Postgres

| Símbolo | Archivo | Por qué |
|---|---|---|
| `drainQabOutbox` | `src/lib/qab/outboxDrain.ts` | Transacción real, `$queryRaw` con `FOR UPDATE SKIP LOCKED`, dos `updateMany` |
| `claimOutboxBatch` | `src/lib/qab/outboxDrain.ts` | Ya era impura; no se modifica, pero los criterios 6 y 7 dependen de su `WHERE` y de su `ORDER BY` |

**Los criterios 5, 6, 7, 8 y 9 son del `qa`**, no de esta suite: exigen filas reales, un servidor de
captura HTTP y varias corridas del drenaje. Un test con un `tx` falso que afirme «no se escribió»
verificaría el mock, no el comportamiento.

### 11.3 Aserciones preexistentes que este contrato invalida — hay que actualizarlas

Son **tres**, y están nombradas una por una porque el `dev-tester` no ve la implementación y no
puede descubrirlas. Con `.default([])` el tipo de salida lleva la clave, así que un `toEqual` que
fija la forma exacta se pone rojo. Hay precedente inmediato de hacerlo en sitio con un comentario:
F-027 lo hizo al añadir `withheld`.

| Archivo | Test | Cambio |
|---|---|---|
| `src/__tests__/qabSync.test.ts` | `describe("qabOutboxAckPlanSchema")` → *"should accept an empty plan"* | El `toEqual` pasa a esperar también `deferrals: []` |
| `src/__tests__/outboxAck.test.ts` | `describe("planOutboxAck")` → *"should return an empty plan for an empty row list…"* | El `toEqual` pasa a esperar también `deferrals: []` |
| `src/__tests__/outboxAck.test.ts` | `describe("emptyQabOutboxDrainReport")` → el `toEqual` de la forma completa | Añadir `deferrals: []` |

Las demás aserciones de esos dos archivos usan `safeParse` o comparan listas concretas, así que
**no** cambian. En particular, la que comprueba que cada id aparece exactamente una vez
(`[...processedIds, ...failedAcks.map(...)]`) sigue valiendo para su fixture, que no tiene
arrastrados; si se le añade uno, la suma tiene que incluir `deferrals`.

### 11.4 Símbolos que este feature **no** añade

Escrito para que nadie los busque: no hay servicio nuevo en `src/services/`, no hay store, no hay
hook, no hay componente, no hay endpoint, no hay columna, no hay índice, no hay migración y **no
hay una segunda función colectora** al estilo de `collectQabPermanentFailures` — la lista la produce
`planOutboxAck`, que es la única autoridad (ADR 0102, alternativas).

## 12. Cómo se verifica cada criterio

El servidor de captura es el patrón que el spec describe: un servidor HTTP local de la suite que
responde lo que el test le programe y expone lo que recibió. **Nunca contra QAB real.**

| Criterio | Verificación puramente ejecutada | Guarda pura que la acompaña |
|---|---|---|
| **5** — las dos filas intactas, `intentos` del `PRODUCT` sin mover | Sembrar `CATEGORY` (id menor) y `PRODUCT` (id mayor), responder `207` con el `CATEGORY` en `failed[]` con un error propio y el `PRODUCT` con el código de arrastre, correr el drenaje, releer las dos filas y compararlas campo a campo con las de antes | `planOutboxAck` pone el `PRODUCT` en `deferrals` y el `CATEGORY` en `failedAcks` |
| **6** — orden en la petición siguiente | Segunda corrida sobre la misma siembra; leer el cuerpo recibido y comprobar que el `CATEGORY` está en una posición anterior en `events` | — (no hay lógica nueva: `ORDER BY o.id`) |
| **7** — el `CATEGORY` sube a 6 y deja de tomarse; el `PRODUCT` sigue en 0 | Seis corridas leyendo las dos columnas tras cada una; séptima corrida: el `CATEGORY` ya no aparece en la petición y el `PRODUCT` sí, viajando solo | — |
| **8** — la otra pareja | Lo mismo con `CURRENCY` + `EXCHANGE_RATE`. **No hace falta test negativo de `CURRENCY → PRODUCT`**: la clasificación no razona sobre entidades, solo sobre el código | El caso de `matchQabOutboxDeferralCode` es el mismo, y la tabla de § 5.2 no distingue por entidad |
| **9** — nadie más deja de gastar intento | (a) corrida con todo en `ok`: ninguna fila mueve `intentos`; (b) corrida con una fila en `failed[]` con un error propio: **esa** sube uno. Comparando la columna de todas las filas del lote antes y después de cada corrida | Las filas 3, 4 y 5 de la tabla de § 5.2, y los casos de `matchQabOutboxDeferralCode` que devuelven `undefined` |
| **10** — la clasificación es pura | `npx vitest run` sin Postgres y sin red sobre los casos de `matchQabOutboxDeferralCode` y de `planOutboxAck` | Es el criterio entero |
| **11** — nada de payload, token ni cuerpo de error en logs | El procedimiento de § 9, con su control positivo | Los cinco hechos de § 9 |

Tres detalles de siembra que cambian el resultado y conviene no descubrir a medias:

- **El negocio sembrado necesita `tiendaOnlineHabilitada = true` y `qabToken`**, o el drenaje no lo
  reclama, o lo acusa con `QAB_OUTBOX_ERROR_CODES.tokenMissing` sin llamar al servidor de captura, y
  el criterio pasa sin haber ejercitado nada (E-008).
- **`CATEGORY` y `PRODUCT` tienen que ser del mismo negocio y estar en el mismo lote**, con el
  `CATEGORY` con `id` menor. Si el `id` del `PRODUCT` fuera menor, el caso ni siquiera es el que el
  contrato de QAB describe.
- **El drenaje solo reclama las entidades de `QAB_OUTBOX_DRAINABLE_ENTITIES`**, que se **deriva** de
  las retenidas (ADR 0092): `BUSINESS` sigue retenida y no sirve para sembrar este caso.
- **Cuidado con acotar el drenaje apagando la tienda online de otros negocios** para que el lote sea
  solo el de la siembra: es lo que la parte A tuvo que hacer, y hay que **restaurarlos** después
  (E-051, y la limpieza se comprueba, no se declara).

## 13. Alcance — lo que esta pieza no hace

Repetido aquí porque es donde el `implementer` y el `dev-tester` lo van a leer, y con las mismas
palabras que el spec y los ADR. **Nada de absolutos que el código no sostenga** (E-017):

- **Cubre** una entrada de `failed[]` cuyo `error` es exactamente el código de arrastre: esa fila se
  deja intacta y se reintenta tal cual en la corrida siguiente, sin gastar intento.
- **No repara** el producto (ni la tasa) que quedó huérfano porque su dependencia **agotó** sus
  intentos. Queda fuera **por decisión del humano del 2026-09-07**. No lo diseñes, no lo dejes medio
  preparado y **no escribas en ningún docstring, comentario, ADR ni test que este feature lo
  cubra**.
- **No se fabrica ninguna marca de tiempo.** Un arrastrado se reintenta **tal cual, con su
  `payload.updatedAt` original**, porque nunca llegó a aplicarse. La reparación a posteriori que
  queda fuera necesitaría una marca **nueva**: las dos reglas viven en el mismo camino y son
  opuestas. Si en algún momento de la implementación aparece un `new Date()`, un `now()` o un
  `updatedAt` calculado en este camino, **eso es una desviación del contrato**, no una mejora.
- **No cambia nada de cómo se trata una dependencia que nunca llega a estar en el mismo lote** que
  su dependiente. La cascada del contrato es solo **dentro** del lote y solo **hacia adelante**, y
  este feature tampoco cubre ese caso.
- **No hay cota nueva y explícita** al número de veces que una fila puede quedar exenta. Lo que la
  acota es la dependencia, que sigue gastando sus propios intentos, y la guarda contra el silencio
  es el log y el informe (ADR 0103 § 2, que también escribe el residual que **no** cubre).
- **Al cerrar esta rodaja, F-028 sí puede pasar a `passes: true`** — será la primera vez que los
  once criterios estén verificados. Solo el `qa`, ejecutando, lo autoriza.
