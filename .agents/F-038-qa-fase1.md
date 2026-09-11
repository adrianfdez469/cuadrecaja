# F-038 — QA fase 1: líneas base (antes del cambio de código)

> Escrito por el agente `qa`. Esta fase **no cambia código**: `QAB_OUTBOX_WITHHELD_ENTITIES` sigue
> siendo `[QAB_BUSINESS_ENTITY] as const` en `src/constants/qab.ts` al cierre de este informe.
> `git diff -- src/` está vacío. Verificado, no supuesto: ver § 8.

## 1. Emparejamiento CC↔QAB — confirmado ejecutando, no solo con un 200 en la raíz

QAB (`next dev -p 3001` desde `queandabuscando`) y cuadrecaja (puerto 3000) están levantados. Que
la raíz responda 200 no prueba que el token sirva, así que se corrió una pasada real del drenaje
(el probe del contrato § 3, con el código **viejo**) contra `Negocio Demo`
(`aebade50-084b-4988-8d31-14b4e53f7d58`, único de los 6 negocios con `tiendaOnlineHabilitada` que
tiene `qabToken`):

```
SENT     {"negocioId":"aebade50-084b-4988-8d31-14b4e53f7d58","events":[
           {"eventId":"12052","entity":"EXCHANGE_RATE"},{"eventId":"12053","entity":"CURRENCY"},
           {"eventId":"12055","entity":"EXCHANGE_RATE"},{"eventId":"12091","entity":"CURRENCY"}]}
RECEIVED {"kind":"ok","response":{"ok":["12052","12053","12055","12091"],"failed":[],
           "results":[{"eventId":"12052","status":"processed"},{"eventId":"12053","status":"processed"},
                      {"eventId":"12055","status":"processed"},{"eventId":"12091","status":"processed"}]}}
```

`kind: "ok"` (nunca `"error"` con `HTTP:400:`), los cuatro `processed`. **El emparejamiento está
vivo**: el token de `Negocio Demo` es válido para las rutas de sync reales, con tráfico real
aplicado del otro lado. No hizo falta rotar ni acuñar nada.

## 2. Atraso `BUSINESS` fabricado — obligatorio, y lo digo explícito

El atraso real acumulado desde que F-027 cerró era de **una sola fila** (`B1` preliminar = 1, tal
como midió el coordinador). Por el eje del TAMAÑO del fixture (E-008), una fila no ejercita la
propiedad central del feature —que los eventos se reclaman en orden de `id`/`updatedAt` y cada uno
pisa al anterior—, así que fabriqué atraso **por el camino del producto**, nunca por SQL, con la
sesión de `superadmin` (el usuario `admin` no tiene `configuracion.administrador`, así que sus
llamadas dieron `403 Sin permiso`; `superadmin` salta ese gate) contra las rutas reales:

| # | Acción | Ruta | Lista resultante (`displayCurrencies`) |
|---|--------|------|------------------------------------------|
| 0 | (preexistente, F-027/uso real) | — | `["CUP","EUR","USD"]` — id `12054`, `ocurridoAt` 2026-09-07T17:09:18.523Z |
| 1 | Habilitar GBP | `POST /api/negocio/{id}/monedas` `{"monedaCode":"GBP",...}` | `["CUP","EUR","GBP","USD"]` — id `12092` |
| 2 | Desactivar EUR | `PUT /api/negocio/{id}/monedas/EUR` `{"activo":false,...}` | `["CUP","GBP","USD"]` — id `12093` |
| 3 | Desactivar USD | `PUT /api/negocio/{id}/monedas/USD` `{"activo":false,...}` | `["CUP","GBP"]` — id `12094` |
| 4 | Reactivar EUR | `PUT /api/negocio/{id}/monedas/EUR` `{"activo":true,...}` | `["CUP","EUR","GBP"]` **— la última, la que debe quedar aplicada en QAB** |

Las cinco listas son **pairwise distintas** entre sí, en orden de `id` ascendente = orden de
`ocurridoAt` ascendente. **Esto es atraso FABRICADO por mí en esta sesión, no el atraso real
acumulado desde F-027** — la fase 2 tiene que leerlo así: el criterio 2 se está verificando sobre
5 filas, de las cuales 4 las inserté yo hoy con este propósito, y 1 es la original de F-027/uso
real.

Cuando la fase 2 drene, debe comprobar que la lista que QAB terminó aplicando es exactamente la
del id `12095` (`["CUP","EUR","GBP"]`) — nunca una intermedia, y en particular **no** `["CUP",
"EUR","USD"]` (la más vieja) ni una que conserve USD (que sale del negocio a partir del evento
`12093`).

## 3. Las seis líneas base

| # | Qué | Valor | Comando/lectura |
|---|-----|-------|-----------------|
| **B1** | `BUSINESS` pendientes, total | **5** | `SELECT count(*) FROM "OutboxEvento" WHERE entidad='BUSINESS' AND "procesadoAt" IS NULL` |
| **B2** | De esas, reclamables (tienda online encendida, `intentos<6`) | **5** | misma + `JOIN Negocio` + `tiendaOnlineHabilitada=true` |
| **B3** | De esas, enviables (además con token) | **5** | misma + `qabToken IS NOT NULL AND <> ''` |
| **B4** | Informe con la retención puesta (código viejo) | `withheld: [{"entidad":"BUSINESS","pending":5,"oldestOcurridoAt":"2026-09-07T17:09:18.523Z"}]`, `claimed:4, processed:4, failed:0` | corrida real del probe § 3 del contrato |
| **B5** | Línea de log del atraso retenido | `qab.outbox.withheld entidad=BUSINESS pending=5 oldest=2026-09-07T17:09:18.523Z` (exactamente **una** aparición) | stdout de esa misma corrida |
| **B6** | El verde previo | `npx vitest run` → exit **0**, **208 archivos / 4291 tests pasando / 1 saltado** (coincide exacto con lo que `arch-guardian` reportó en § 1.4 del contrato); `npx tsc --noEmit` → exit **0**; `npm run lint` → exit **0**, **0** apariciones de `Error:` (solo warnings preexistentes) | los tres exit codes leídos de archivo, nunca de un pipe (E-045) |

B4 y B1 coinciden exactamente (`N=5`), tal como exige el contrato § 5. B5 tiene su única línea.
B6 reproduce byte a byte los números que `arch-guardian` había medido al probar y revertir el
cambio.

**B1 = 5, así que sigue por debajo de `QAB_OUTBOX_BATCH_SIZE` (500).** Por la regla de ADR 0092 §
9 del contrato: no hace falta abrir ningún ADR de coalescing ni de ventana de milisegundo. Quede
anotado, tal como el contrato exige que se anote pase lo que pase.

## 4. Riesgo B (§ 10 del contrato) — estado inicial de `intentos`

```sql
SELECT intentos, "ultimoError", count(*) FROM "OutboxEvento"
WHERE entidad = 'BUSINESS' AND "procesadoAt" IS NULL GROUP BY intentos, "ultimoError";
```

```json
[{"intentos": 0, "ultimoError": null, "count": "5"}]
```

Las cinco filas están en `intentos=0, ultimoError=null`, **antes y después** de la corrida de B4
(reconsulté tras B4: sigue `0/0/0/0/0`, sin cambio — la retención las protegió como debía). Este es
el punto de referencia contra el que la fase 2 debe comparar tras cada corrida posterior al
cambio: cualquier fila con `intentos > 0` en la primera corrida nueva es la señal de parar e
investigar (§ 10 riesgo B, paso 8 del § 6).

## 5. Hallazgo del coordinador, no anticipado por el contrato: el backlog no-`BUSINESS` de `Negocio Demo` está mayormente AGOTADO

El contrato § 3 dice: *"Esa corrida sí manda los `PRODUCT`, `CATEGORY`, `CURRENCY`,
`EXCHANGE_RATE` y `STORE` pendientes (había 56/11/6/4/3 cuando lo miré)... anota el resultado."*
Lo anoto, y no es lo que el contrato esperaba:

```sql
SELECT n.nombre, o.entidad, o.intentos, count(*) FROM "OutboxEvento" o
JOIN "Negocio" n ON n.id = o."negocioId"
WHERE o."procesadoAt" IS NULL GROUP BY n.nombre, o.entidad, o.intentos ORDER BY n.nombre, o.entidad;
```

Para `Negocio Demo` (el único con token): **`PRODUCT` 55, `CATEGORY` 8, `CURRENCY` 4,
`EXCHANGE_RATE` 2, `STORE` 3 — TODAS a `intentos = 6`**, es decir, **ya agotadas y excluidas para
siempre** de `claimOutboxBatch` (su filtro es `intentos < QAB_OUTBOX_MAX_ATTEMPTS`). Estas filas
son anteriores a esta sesión (no las toqué) y no son atraso vivo: no van a drenar nunca, ni con el
código nuevo, porque el filtro de reclamación ya las excluye por `intentos`. El único tráfico
no-`BUSINESS` que la corrida de B4 realmente movió fueron **4 filas frescas** (`intentos=0`, 2
`CURRENCY` + 2 `EXCHANGE_RATE`) que no pertenecían al backlog agotado — y las procesó con éxito
(`ok`, `processed`), que es justo lo que confirma el emparejamiento del § 1.

**Consecuencia para la fase 2:** no leer los "56/11/6/4/3" del contrato como una promesa de que
esa corrida iba a mandar 80 eventos no-`BUSINESS` — esa cifra ya estaba mayormente muerta antes de
que nadie tocara la constante. No bloquea ningún criterio (los seis son sobre `BUSINESS`, y el
comportamiento de `claimOutboxBatch`/`intentos<6` es correcto y preexistente, ajeno a F-038), pero
sí cambia la lectura de "qué tráfico llega realmente a QAB en la primera corrida tras el cambio":
va a ser, sobre todo, los 5 `BUSINESS` liberados + el 1 `PRODUCT` fresco del § 6 de abajo, no un
lote de 80 eventos histórico.

## 6. Criterio 4 preparado — un `PRODUCT` fresco encolado tras B4

Como el backlog `PRODUCT` viejo de `Negocio Demo` está agotado (§ 5), no sirve para el lote mixto
del criterio 4: hace falta un evento nuevo, con `intentos=0`. Lo generé por el camino del
producto, **después** de B4:

```
PATCH /api/tienda-online/productos/a913fed5-efa6-407f-9036-3cf040a3c231
Body: {"publicarEnTienda": true}
→ 200, {"eventos":1, "syncState":{"state":"PENDING","attempts":0,...}}
```

Confirmado en base:

```sql
SELECT id, entidad, "entidadId", intentos, "procesadoAt" FROM "OutboxEvento"
WHERE entidad='PRODUCT' AND "negocioId"='aebade50-084b-4988-8d31-14b4e53f7d58'
  AND "procesadoAt" IS NULL AND intentos < 6;
```
```json
[{"id":"12096","entidad":"PRODUCT","entidadId":"b9cf824b-625f-4107-8e95-b9bc0a11b357","intentos":0,"procesadoAt":null}]
```

**Aviso — este `PRODUCT` (id `12096`) se consumió en la fase 1b** (§ 10 más abajo), al drenar el
evento `STORE` de reapertura con el código todavía viejo. Volví a sembrar un `PRODUCT` fresco al
cerrar la fase 1b (§ 10) — son los ids `12099`/`12100` los que quedan pendientes para el criterio
4, no el `12096` de este párrafo. Queda el razonamiento porque explica el mecanismo, no los ids.

## 7. Bloqueante del criterio 5 — RESUELTO en la fase 1b (§ 10)

Esta sección describía, al cierre de la fase 1, que la única tienda sincronizada de `Negocio Demo`
(`Tienda Principal`) estaba cerrada del lado de QAB por un fixture de una ronda de QA anterior, y
que sin reabrirla el criterio 5 era inverificable. **El coordinador ordenó resolverlo por el
camino del producto (apagar/encender el opt-in de publicación, dos drenajes) en la fase 1b — ver
§ 10. La tienda quedó reabierta y confirmada.** No hizo falta tocar la base de datos de QAB a
mano en ningún momento.

## 8. Confirmación de las restricciones

- `git diff -- src/` → **vacío**. `QAB_OUTBOX_WITHHELD_ENTITIES` sigue en
  `[QAB_BUSINESS_ENTITY] as const` (`src/constants/qab.ts:783`).
- Sondas usadas: `qaf038-sql.ts` (SQL de lectura vía Prisma) y `qaf038-probe.ts` (el probe § 3 del
  contrato, textual). Las dos vivieron en la raíz del repositorio (E-053) y **se borraron** al
  terminar. `git status --porcelain` no muestra rastro suyo — solo los tres archivos ya
  preexistentes de otros agentes de este mismo feature (`.agents/progress/F-038.md`,
  `.agents/security/F-038.md`, `.agents/specs/F-038.md`), que no son míos.
- `grep -rnE '(/Users/|/home/|~/|[A-Z]:\\)' .agents/ .claude/ --include='*.md' --include='*.json'`
  no encontró ninguna ruta absoluta nueva: los únicos matches son comandos `grep` de ejemplo y
  documentación histórica de E-001 ya existentes antes de esta sesión. Los tres archivos nuevos de
  F-038 (`spec`, `security`, `progress`) están limpios.
- Prefijo `QAF038` — no apliqué: todos los datos sembrados son mutaciones **reales** sobre
  `Negocio Demo` (un negocio ya existente, no un fixture nuevo), así que no había un nombre propio
  que prefijar; no toqué ningún fixture `QA-F004-*`/`QA-F006-*`/`QA-F009-*` (E-040).
- Ningún token, secreto ni valor de variable de entorno aparece en este informe ni en ningún log
  que haya dejado.

## 9. Estado para la fase 2 — resumen operativo (actualizado tras la fase 1b, ver § 10)

- Cuando el `implementer` vacíe `QAB_OUTBOX_WITHHELD_ENTITIES`, la primera corrida del drenaje
  debe: (a) reclamar las 5 filas `BUSINESS` + las filas `PRODUCT` `12099`/`12100`, en el mismo
  lote de `Negocio Demo` (criterio 4); (b) dejar `withheld: []` y cero líneas
  `qab.outbox.withheld` (criterio 1); (c) terminar con las 5 `BUSINESS` en `procesadoAt` no nulo y
  B2 en 0 (criterio 2).
- El criterio 5 **ya es alcanzable**: `tienda-principal` quedó reabierta del lado de QAB en la
  fase 1b (§ 10). No hace falta ninguna acción adicional antes de intentarlo.
- El control `stale` del criterio 3 (§ 4.2 del contrato) todavía no está sembrado — le
  corresponde a la fase 2, después del criterio 2, usando `T_aplicado` del evento `12095` una vez
  drenado.

## 10. Fase 1b — reapertura de `tienda-principal` por el camino del producto (antes del cambio de código)

> Encargo del coordinador, recibido mientras redactaba la fase 1: reabrir la tienda de QAB **desde
> cuadrecaja**, nunca tocando la base de datos de QAB a mano, y confirmar que el criterio 5 es
> alcanzable. Sigue sin tocarse `src/`, tests, `features.json` ni `.agents/specs/F-038.md`; el
> código sigue siendo el viejo (`QAB_OUTBOX_WITHHELD_ENTITIES = [QAB_BUSINESS_ENTITY] as const`)
> durante todo este paso.

### 10.1 Mecanismo usado

Un evento `STORE` con el opt-in de publicación (`publicarEnTienda`) **cambiado** respecto al que
QAB tiene registrado es lo único que republica una tienda que el panel de QAB cerró por su cuenta
(`sync-contract.md` § "Novedades... `unpublishReason`", y el propio comentario de
`Store.sourceOptIn`/`disabledReasonCode` en el `schema.prisma` de queandabuscando: *"cleared
together whenever the store republishes"* / *"only touch `status`/`disabled*` [when the opt-in
changed] — otherwise editing a phone number in the POS would silently reopen a store the admin
closed for vacation"*). `STORE` nunca estuvo en `QAB_OUTBOX_WITHHELD_ENTITIES`, así que drenarlo
con el código viejo es seguro y no toca ninguna fila `BUSINESS`.

Secuencia, con la sesión `superadmin` (Negocio Demo) contra la ruta real
`PATCH /api/tienda-online/configuracion/{tiendaId}` (reemplazo completo del bloque de
`Tienda Principal`, únicamente con `publicarEnTienda` cambiado, el resto de campos igual a como
`GET /api/tienda-online/configuracion` los devolvía):

1. `PATCH ... {"publicarEnTienda": false, ...resto igual...}` → `200`, evento `STORE` fresco
   (`eventId: "12097"`, `attempts: 0`).
2. Drenaje (probe § 3 del contrato, código viejo): `claimed: 2` (`12096` `PRODUCT` + `12097`
   `STORE`, ambos `processed`), `withheld` sigue `[{"entidad":"BUSINESS","pending":5,...}]` sin
   cambio. **Esto consumió el `PRODUCT` `12096`** que había dejado listo en la fase 1 — anotado y
   corregido en § 6/§ 10.4.
3. `PATCH ... {"publicarEnTienda": true, ...resto igual...}` → `200`, evento `STORE` fresco
   (`eventId: "12098"`, `attempts: 0`).
4. Drenaje: `claimed: 1` (`12098` `STORE`, `processed`), y por primera vez
   `appliedStoreEvents: [{"negocioId":"aebade50-...","tiendaId":"3241e887-..."}]` — la señal de que
   el handler de QAB SÍ tocó `status`/`disabled*` en esta aplicación. `withheld` sigue idéntico.

No hubo ningún aviso de guarda anti-rancio (`sourceUpdatedAt`): los dos eventos llevan
`ocurridoAt`/`updatedAt` estrictamente crecientes (04:01:28 → 04:01:49), y los dos se aplicaron.

### 10.2 Confirmado del lado de QAB — leído, no supuesto

Consulta directa (solo lectura) contra la base de QAB, `Store` por `externalId` = el `Tienda.id`
de `Tienda Principal`:

```json
{
  "status": "PUBLISHED",
  "disabledReasonCode": null,
  "disabledMessage": null,
  "disabledAt": null,
  "sourceOptIn": true,
  "sourceUpdatedAt": "2026-09-11T04:01:49.767Z"
}
```

Los tres `disabled*` en `null`, `status: PUBLISHED`, `sourceOptIn: true` — exactamente lo que pedía
el punto 1 del encargo.

**En el navegador (HTTP real, `GET http://localhost:3001/tienda-principal` → 200):** la página
dejó de traer el banner *"No disponible ahora"* / *"Cerrado por..."* y pasó a renderizar la tienda
abierta completa — encabezado con enlace al catálogo, buscador, botón de Carrito, horario
("todos los días de 9:00 a.m. a 6:00 p.m.", que QAB ya tenía guardado de antes), sección de
Catálogo. `<title>` pasó de `"Tienda Principal · No disponible ahora · queandabuscando"` a
`"Tienda Principal · queandabuscando"`.

### 10.3 El «antes» del criterio 5 — capturado ahora, porque este mismo paso lo destruye

Con la tienda ya abierta pero con `QAB_OUTBOX_WITHHELD_ENTITIES` todavía reteniendo `BUSINESS`
(código viejo, sin tocar), la página **no monta ningún selector de moneda**: no aparecen los
atributos `data-ref-choices`/`data-ref-default` (`REFERENCE_CURRENCY_CHOICES_ATTR`/
`_DEFAULT_ATTR`, `queandabuscando/src/constants/currency.ts`) en el HTML servido. Causa,
confirmada leyendo la fila real en la base de QAB:

```sql
SELECT id, "externalId", "baseCurrencyCode", "displayCurrencies", "displayCurrenciesSourceUpdatedAt"
FROM "Business" WHERE "externalId" = 'aebade50-084b-4988-8d31-14b4e53f7d58';
```
```json
{"id":"0b0486ab-...","externalId":"aebade50-...","baseCurrencyCode":"CUP",
 "displayCurrencies":[], "displayCurrenciesSourceUpdatedAt": null}
```

`displayCurrencies: []` y `displayCurrenciesSourceUpdatedAt: null` — QAB **nunca recibió un
evento `BUSINESS`** para este negocio (consistente con el comentario del propio campo en el
`schema.prisma` de QAB: *"`@default([])` and 'never received a BUSINESS event' are
indistinguishable"*). Es el estado correcto y esperado con la retención todavía puesta.

**Este es el «antes» del criterio 5, y hay que leerlo así:** ahora mismo la tienda ofrece
**cero monedas seleccionables** (ni siquiera aparece el selector). Cuando la fase 2 vacíe la
lista y drene el atraso (criterio 2), `displayCurrencies` debe pasar a `["CUP","EUR","GBP"]` (la
lista del evento `12095`, la última) y el selector debe aparecer por primera vez con esas tres. Y
solo entonces, para el propio criterio 5, hay que desactivar una moneda **nueva** (p. ej. GBP o
EUR) y confirmar que desaparece — nunca comparar contra este «antes» de cero monedas, que es el
estado previo a que el interruptor exista, no el estado previo a apagar una moneda concreta.

### 10.4 `PRODUCT` para el criterio 4 — resembrado tras el consumo accidental

El drenaje del paso 2 de § 10.1 consumió el `PRODUCT` `12096` que había dejado listo en la fase 1
(§ 6). Volví a generarlo por el camino del producto, esta vez **sin drenarlo** (para no repetir el
mismo error):

```
PATCH /api/tienda-online/productos/a913fed5-efa6-407f-9036-3cf040a3c231  {"publicarEnTienda":false} → 200, eventos:1
PATCH /api/tienda-online/productos/a913fed5-efa6-407f-9036-3cf040a3c231  {"publicarEnTienda":true}  → 200, eventos:1
```

```sql
SELECT id, entidad, "entidadId", intentos, "procesadoAt" FROM "OutboxEvento"
WHERE entidad='PRODUCT' AND "negocioId"='aebade50-084b-4988-8d31-14b4e53f7d58'
  AND "procesadoAt" IS NULL AND intentos < 6;
```
```json
[{"id":"12099", "intentos":0, "procesadoAt":null},
 {"id":"12100", "intentos":0, "procesadoAt":null}]
```

Quedan **dos** `PRODUCT` pendientes y reclamables (mismo producto, "Papas Fritas" en
`Tienda Principal`, dos ediciones consecutivas de su publicación) para el criterio 4. No los
dreno: la fase 2 los necesita intactos junto con las 5 `BUSINESS`.

### 10.5 B1/B2/B3 revalidados tras la fase 1b

```sql
SELECT id, intentos, "ultimoError", "procesadoAt" FROM "OutboxEvento" WHERE entidad='BUSINESS' ORDER BY id;
```

Las 5 filas (`12054`, `12092`, `12093`, `12094`, `12095`) siguen **`intentos=0`,
`ultimoError=null`, `procesadoAt=null`** — sin cambio frente a la fase 1, pese a las dos corridas
de drenaje de este paso. **B1 = 5, B2 = 5, B3 = 5**, recontadas con el mismo SQL de § 3.

### 10.6 El backlog agotado (hallazgo de la fase 1) sigue igual, sin interferir

```sql
SELECT entidad, intentos, count(*) FROM "OutboxEvento"
WHERE "negocioId"='aebade50-084b-4988-8d31-14b4e53f7d58' AND "procesadoAt" IS NULL
GROUP BY entidad, intentos ORDER BY entidad;
```

`CATEGORY` 8, `CURRENCY` 4, `EXCHANGE_RATE` 2, `PRODUCT` 55, `STORE` 3 — **todas siguen a
`intentos=6`**, idéntico a la fase 1. Las dos corridas de este paso no las tocaron (ya están
excluidas de `claimOutboxBatch` por el filtro `intentos<6`) y no compiten con el lote mixto del
criterio 4, que se apoya en los `PRODUCT` frescos `12099`/`12100`. **No los recuperé ni los toqué**,
tal como pidió el coordinador.

### 10.7 Restricciones de la fase 1b

- No se tocó la base de datos de QAB **a mano**: las dos únicas escrituras del lado de QAB fueron
  aplicadas por su propio handler de sync al recibir los eventos `STORE` reales. Las lecturas
  contra la base de QAB (`Store`, `Business`) fueron `SELECT` puros, con una sonda temporal
  (`qaf038b-qab-sql.ts`) creada en la raíz de `queandabuscando` y **borrada** al terminar —
  `git status --porcelain` de ese repositorio queda limpio.
- `git diff -- src/` de cuadrecaja sigue vacío; `QAB_OUTBOX_WITHHELD_ENTITIES` sigue en
  `[QAB_BUSINESS_ENTITY] as const`.
- Ningún fixture `QA-F004-*`/`QA-F006-*`/`QA-F009-*` fue tocado.
