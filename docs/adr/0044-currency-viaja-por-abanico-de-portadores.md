# ADR 0044: `CURRENCY` viaja por abanico de portadores, no por un negocio dueño

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-006
**Se apoya en:** [ADR 0021](0021-el-interruptor-filtra-las-dos-fases-del-cron.md) ·
[ADR 0043](0043-el-orden-de-emision-se-sostiene-por-el-orden-de-insercion-en-el-outbox.md) ·
contrato QAB v10.1, § ① «`payload` de `CURRENCY`» y § Autenticación

## Contexto

El spec de F-006 delega esta decisión al arquitecto de forma explícita (regla de negocio 12), y la
plantea así: **una entidad global sobre un transporte que no lo es.**

Los tres hechos que chocan:

1. **`CURRENCY` es la única de las cinco entidades cuyo `payload` no lleva `businessId`**, y su
   tabla del otro lado es **global a la plataforma**: una fila por `code`, compartida por todos los
   negocios. El contrato lo dice sin rodeos: *«Un evento `CURRENCY` de un negocio reescribe el
   `name` y el `symbol` que ven los demás. Por eso es el único `payload` que la comprobación de
   identidad se salta: no hay campo que comprobar.»*
2. **La petición que lo transporta sigue necesitando el token de un negocio.** § Autenticación:
   *«El token es por negocio, no un secreto único de plataforma»*. No existe un token de
   plataforma para `/api/internal/sync/catalog`.
3. **El outbox de F-002 es por negocio.** `OutboxEvento.negocioId` es obligatorio, con clave ajena
   a `Negocio`, y el drenaje agrupa por negocio para elegir el token.

El disparador que hace visible la tensión es el segundo que el humano confirmó (criterio 18): un
`SUPER_ADMIN` edita `Moneda.nombre` o `Moneda.simbolo` desde `/api/admin/monedas/[code]`. Esa
tabla **no tiene `negocioId`** —`Moneda.code` es `@id`— así que la edición **no pertenece a ningún
negocio**. No hay un «dueño» al que atribuirla.

El spec deja abierta la salida: si no hay solución limpia con el contrato actual, se registra
`S-003` en `.agents/solicitudes-qab.md` y la conversación con queandabuscando es una v11.

Restricción añadida por el `security-guardian`, vinculante: **el negocio cuyo token transporte la
emisión no puede obtener ningún privilegio adicional sobre los demás, y no debe poder inferirse ni
filtrarse a otros negocios qué negocio fue el emisor técnico.**

## Decisión

**No hay negocio dueño: hay portadores. Una edición de la fila global de `Moneda` encola un evento
`CURRENCY` en el outbox de cada negocio portador, con el mismo `payload` byte a byte.** No se abre
`S-003`: el contrato actual da una solución limpia.

**Portador** es un negocio que cumple las dos condiciones:

- tiene la tienda online **habilitada** (`Negocio.tiendaOnlineHabilitada = true`), y
- tiene esa moneda habilitada (`NegocioMoneda.activo = true` para ese `code`) **o** ya emitió antes
  un evento `CURRENCY` de ese `code`.

Se ordenan por `negocioId` ascendente y se acotan con `QAB_CURRENCY_FANOUT_MAX_BUSINESSES`
(`src/constants/qab.ts`). La lectura vive en `readQabCurrencyCarriers`
(`src/lib/qab/qabCatalogOutboxFilters.ts`) y el reparto en `planQabCurrencyFanout`
(`src/lib/qab/qabCatalogEmission.ts`), que es **puro** y hace el bucle él mismo.

Por qué esto satisface la restricción de seguridad, punto por punto:

- **Ningún portador gana nada.** El `payload` es idéntico para todos y sale de `Moneda.nombre` /
  `Moneda.simbolo`, que en cuadrecaja son globales y **solo editables por `SUPER_ADMIN`**
  (`hasSuperAdminPrivileges()` en `PUT /api/admin/monedas/[code]`). Un comerciante no puede
  inyectar una denominación propia por esta vía, tenga o no tenga el token que la transportó.
- **Quién la transportó no es observable.** El `payload` no lleva `businessId` —ni ninguna otra
  marca del emisor— así que del lado de queandabuscando no queda rastro de qué negocio la llevó.
  Del lado de cuadrecaja el rastro es `OutboxEvento.negocioId`, que ya está aislado por negocio
  como cualquier otra fila del outbox.
- **Las dos tablas globales se corresponden.** `Moneda` en cuadrecaja y `Currency` en
  queandabuscando son ambas globales y ambas de administración. La edición global es el disparador
  natural, y el abanico solo elige **cómo llega**, no **qué llega**.

**El cap es seguro aquí, y no lo sería en la cascada de categorías.** Es la razón de que sean dos
constantes y no una: como la fila del otro lado es **global**, con que **un** portador entregue el
evento la moneda queda corregida **para todos**. Los demás portadores son redundancia frente a un
token roto o un negocio sin drenar, no cobertura. `QAB_CATEGORY_CASCADE_MAX_BUSINESSES` no tiene
esa propiedad —cada negocio tiene su propia fila `LocalCategory`— y por eso su truncamiento se
expone en la respuesta.

### El endurecimiento de la escritura global (criterio 20)

El abanico resuelve **cómo llega** el texto; queda por acotar **qué llega**. El `security-guardian`
señaló que `PUT /api/admin/monedas/[code]` valida `nombre` y `simbolo` con `z.string().min(1)`,
sin tope de longitud ni restricción de charset, y ese valor termina en el escaparate público de
negocios **de terceros** sin que ningún inquilino pueda impedirlo. El humano aprobó cerrarlo
**dentro de F-006**, aprovechando que la ruta ya se toca para encolar el evento.

Tres constantes en `src/constants/qab.ts`, y **son decisión nuestra, no del contrato**: la v10.1
declara `name` y `symbol` como «no vacío» y **no fija ningún límite** para ellos. Escribirlo como
si lo impusiera queandabuscando sería un absoluto que el documento externo no sostiene (E-017).

| Constante | Valor | Por qué ese |
|---|---|---|
| `QAB_CURRENCY_NAME_MAX_LENGTH` | `40` | Los nombres ISO 4217 más largos rondan los 30 caracteres; «Dólar estadounidense» son 20 y «Peso Cubano» 11. 40 deja holgura sin dejar de ser un tope |
| `QAB_CURRENCY_SYMBOL_MAX_LENGTH` | `8` | Un símbolo no es un nombre corto, es otra cosa: `$`, `US$`, `₡`, `лв`. 8 cubre los multi-code-point sin admitir una frase |
| `QAB_CURRENCY_TEXT_FORBIDDEN_PATTERN` | *deny list* | Controles C0/C1 y BOM, formateo bidireccional y de ancho cero (U+200B–U+200F, U+2028/29, U+202A–U+202E, U+2066–U+2069), y los siete de marcado y comillas: menor-que, mayor-que, ampersand, comilla doble, comilla simple, acento grave y barra invertida |

**Deny list y no allow list**, a conciencia: los nombres y símbolos de moneda se escriben
legítimamente en muchos alfabetos (₽, ﷼, 円), y una lista blanca rechazaría datos correctos sin
cubrir nada que esta no cubra. El grupo de marcado está porque **el escaparate no es nuestro** y no
nos toca suponer cómo escapa lo que le mandamos.

**El tope vive en la validación de ENTRADA, no en `qabCurrencyPayloadSchema`.** Es la misma
asimetría que `baseCurrency` frente a `PRODUCT.currency`: una fila de `Moneda` anterior a este
feature puede superar el tope, y si el `payload` lo hiciera cumplir, esa fila **revertiría**
cualquier mutación que la emitiera de pasada —publicar un producto en esa moneda, habilitar una
`NegocioMoneda`, registrar una tasa—. Un dato heredado no puede tumbar operaciones que no lo tocan.
Consecuencia asumida: un valor heredado fuera de tope **sigue viajando** hasta que alguien lo edite.

**Y el orden importa:** validar → persistir → encolar, con los dos últimos en la misma transacción.
Al revés se emitiría un `CURRENCY` de un cambio que no llegó a persistirse.

Los otros dos disparadores de `CURRENCY` no tienen tensión alguna y no la inventan:

- **habilitar una `NegocioMoneda`** → un evento en el outbox de **ese** negocio
  (`emitQabCurrencyForNegocio`);
- **arranque perezoso al publicar un producto** → un evento en el outbox de **ese** negocio, dentro
  de la misma emisión ordenada del ADR 0043.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un «negocio dueño»: el primero que habilitó esa moneda | Frágil de la peor manera: el día que ese negocio pierda el token, apague la tienda online o sea purgado, las ediciones de esa moneda **dejan de propagarse en silencio** y nadie se entera. Y le da a un negocio arbitrario un papel de plataforma que el `security-guardian` prohíbe |
| Un «negocio de plataforma» reservado | No existe, habría que sembrarlo, darlo de alta en queandabuscando con su propio token y mantenerlo vivo. Es infraestructura nueva para transportar cuatro campos de texto. Y un negocio ficticio en `Negocio` contamina todo lo que cuenta negocios (suscripciones, purga, informes) |
| No emitir en la edición global; confiar solo en el arranque perezoso | Es exactamente el agujero que el humano cerró para `CATEGORY` (regla 11): el arranque perezoso solo dispara al **publicar un producto**, nunca al **editar la entidad**. Una moneda renombrada se quedaría con el nombre viejo indefinidamente. Además contradice el criterio 18, que es firme |
| Abrir `S-003` y esperar una v11 con un token de plataforma | El contrato actual **sí** da una solución limpia, así que abrir una solicitud sería pedir un cambio que no hace falta. La puerta que la v10.1 deja abierta se usa cuando ninguna opción encaja, y aquí una encaja |
| Emitir a **todos** los negocios con la tienda online habilitada, sin filtrar por moneda | Multiplica las filas del outbox por negocios que nunca van a mostrar esa moneda, y no mejora nada: la fila del otro lado es global y ya la corrige el primero que llegue |
| Sin cap, para no dejar a ningún portador fuera | Una edición de `SUPER_ADMIN` podría encolar miles de filas en una transacción de una petición HTTP. Y como la fila es global, los portadores extra no aportan cobertura. El cap es la opción correcta **precisamente aquí** |
| Allow list de caracteres para `nombre`/`simbolo` | Rechazaría nombres y símbolos correctos en alfabetos no latinos (₽, ﷼, 円, лв) para no cubrir nada que la deny list no cubra ya |
| Un solo tope de longitud para nombre y símbolo | Un símbolo de 40 caracteres no es un símbolo. Dos conceptos distintos, dos topes |
| Poner el tope en `qabCurrencyPayloadSchema` | Una fila heredada fuera de tope tumbaría el arranque perezoso de cualquier producto en esa moneda, y la mutación entera revertiría por un dato que no se estaba tocando |
| Escapar o sanear el texto en vez de rechazarlo | Saneo silencioso: el `SUPER_ADMIN` cree que guardó una cosa y se guardó otra. Y el escaparate es de terceros: no sabemos contra qué escapar |
| Dejarlo como endurecimiento pendiente fuera de F-006 | Era la propuesta inicial de este ADR. El humano decidió lo contrario, y tiene sentido: la ruta ya se toca aquí, y dejar la superficie abierta mientras se le añade un camino nuevo hacia una tabla global es peor momento que cualquier otro |
| Reutilizar el `payload` construido una vez fuera del bucle | Para `CURRENCY` daría igual (no lleva `businessId`), pero el planificador comparte forma con `planQabCategoryCascade`, donde **sí** importa. Un único patrón —construir dentro del bucle— evita que alguien copie el de fuera al sitio equivocado |

## Consecuencias

**A favor:**

- La tensión se resuelve **sin cambiar el contrato** y sin inventar infraestructura: no se abre
  `S-003`, no se bloquea F-006.
- No hay ningún negocio con papel privilegiado, y ninguno es identificable como emisor desde el
  otro lado.
- El mecanismo es el mismo que la cascada de `CATEGORY` (criterio 17): un solo patrón que aprender,
  dos constantes de tope con razones distintas y escritas.
- Robusto ante un portador roto: si el token de uno falla, otro entrega el mismo evento.
- La escritura de la tabla global queda acotada en longitud y en charset, y esa validación corre
  **antes** de persistir y de encolar (criterio 20).

**En contra / coste asumido:**

- **N escrituras redundantes por edición global.** Todas escriben la misma fila global con el mismo
  valor. Es deliberado: la redundancia es la tolerancia a fallos. La acción es rara y exclusiva de
  `SUPER_ADMIN`.
- **Con más de `QAB_CURRENCY_FANOUT_MAX_BUSINESSES` portadores, el abanico se trunca.** Aceptable
  por el argumento de arriba (basta una entrega), y el `truncated` se devuelve igualmente en
  `IQabFanoutResult` en vez de silenciarse.
- **Un negocio con la tienda online apagada no recibe nada**, ni siquiera pendiente. Es intencional:
  el drenaje filtra sus filas en el propio `claim` (ADR 0021) y se acumularían sin drenar nunca,
  y la purga de F-019 no recoge filas pendientes. Cuando encienda el interruptor, su arranque
  perezoso emitirá la moneda con el valor **actual**.
- **Cambio de comportamiento de un endpoint existente:** un `nombre` o `simbolo` ya almacenado que
  supere el tope nuevo, o contenga un carácter de la lista, pasa a rechazarse la próxima vez que
  alguien reenvíe **ese campo**. Un `PUT` que solo mande `activo` se sigue aceptando, porque las
  tres claves siguen siendo opcionales. Deliberado, no una regresión.
- **Un valor heredado fuera de tope sigue viajando** hasta que se edite, por la decisión de poner
  el tope en la entrada y no en el `payload`.
- **Sigue sin haber guarda anti-rancio en `CURRENCY`** (asimetría 3 del contrato): con reintentos,
  dos eventos del mismo `code` pueden aplicarse al revés y dejar el nombre viejo. Es del contrato,
  no de esta decisión, y el abanico no lo empeora: todos los eventos de una misma edición llevan el
  mismo valor.

**Impacto en seguridad y escalabilidad:**

- El `payload` no lleva `businessId` ni ninguna marca del portador: **el emisor técnico no es
  inferible** desde queandabuscando.
- El contenido sale de una tabla que solo `SUPER_ADMIN` escribe: ningún comerciante puede colar
  texto propio en la vitrina de otro por esta vía. Y desde el criterio 20 esa escritura está además
  **acotada en longitud y en charset** — ver «El endurecimiento de la escritura global», abajo.
- La consulta de portadores lleva tope (`limit`) y entra por `@@unique([negocioId, monedaCode])` de
  `NegocioMoneda` y por `@@index([entidad, entidadId])` del outbox. No recorre el histórico.
- El coste de un disparador normal (habilitar una moneda, arranque perezoso) es **un** evento, no
  un abanico: el abanico solo lo dispara la edición de la tabla global.
