# ADR 0034: Un rechazo de queandabuscando llega a la pantalla como dato dentro de un `200`, nunca como estado HTTP

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-005
**Se apoya en:** [ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) ·
[ADR 0022](0022-ningun-estado-http-de-qab-se-espeja.md) ·
[E-009](../../.agents/errors/E-009-el-interceptor-destruye-el-cuerpo-de-cualquier-403.md)

## Contexto

Dos criterios de F-005 piden lo mismo desde sitios distintos, y ninguno de los dos se puede
cumplir con un estado HTTP.

**El criterio 7 (`BUSINESS_MISMATCH`).** Es un `403` que devuelve queandabuscando a
`POST /api/internal/sync/catalog` cuando el `businessId` del lote no es el del token. Ocurre en el
**cron de drenaje**, un `fetch` de servidor a servidor sin navegador delante: hoy acaba, con toda
corrección, como `HTTP:403:{"error":"BUSINESS_MISMATCH"}` en `OutboxEvento.ultimoError` y ahí se
queda. Nadie lo ve. Y no puede convertirse en un `403` de cuadrecaja para que la pantalla lo lea,
porque **`src/lib/axiosClient.ts` sustituye el cuerpo de cualquier `403` por un error genérico de
permisos** (E-009): llegaría como *«Acceso denegado… asigne los permisos necesarios»*, que además
de inútil es falso.

**El criterio 12 (`STORE_OPENING_HOURS_INVALID`).** Un evento que vuelve en el `failed[]` de un
`207` no se da por procesado —eso ya lo hace `planOutboxAck` correctamente— pero **agota sus seis
reintentos en silencio**. Y es un fallo *permanente*: reintentarlo sin cambiar el dato de
cuadrecaja falla exactamente igual las seis veces. El criterio pide algo **adicional** al reintento
genérico: que quede registrado nombrando el local y el código.

Hay además un tercer problema, de seguridad, que decide la forma: `ultimoError` puede contener
hasta 500 caracteres del cuerpo que devolvió el otro sistema. Reenviarlo tal cual a la pantalla del
comerciante es exponer las tripas de un tercero en una superficie de usuario.

## Decisión

**Todo desenlace de la sincronización que el comerciante o el operador tengan que distinguir viaja
como un campo dentro de una respuesta `200`, con un código de un enum cerrado de cuadrecaja.**
Ningún estado HTTP de cuadrecaja representa un fallo de queandabuscando, y ningún cuerpo de
queandabuscando llega al navegador.

Tres piezas.

**1. `GET /api/tienda-online/configuracion` devuelve, por local, su estado de sincronización.**

```jsonc
{ "state": "FAILED", "code": "STORE_OPENING_HOURS_INVALID", "attempts": 3, "since": "..." }
```

`state` ∈ `SYNCED` · `PENDING` · `FAILED` · `BLOCKED` (agotó los seis intentos).
`code` es uno de `QAB_STORE_SYNC_CODES`, un enum cerrado que incluye `BUSINESS_MISMATCH` y
`STORE_OPENING_HOURS_INVALID`. Se **deriva** de `OutboxEvento.ultimoError` con una función pura,
`normalizeOutboxErrorCode`, que reconoce las formas que el propio F-002 escribe (`EVENT:<code>`,
`HTTP:<status>:<body>`, `TRANSPORT:…`, `QAB_TOKEN_MISSING`) y devuelve `UNKNOWN` para todo lo
demás. **El `ultimoError` crudo no sale nunca de la base.**

Así es como un `403 BUSINESS_MISMATCH` llega a la pantalla distinguible **pese a E-009**: no llega
como `403`, llega como el string `"BUSINESS_MISMATCH"` dentro de un `200` que el interceptor de
Axios no toca.

**2. Un fallo permanente se registra en el momento en que ocurre, nombrando el local y el código.**
`collectQabPermanentFailures` clasifica las entradas del `failed[]` cuyo código está en
`QAB_OUTBOX_PERMANENT_ERROR_CODES` —`STORE_OPENING_HOURS_INVALID`, `STORE_TIMEZONE_INVALID`,
`STORE_DELIVERY_CONFIG_INCONSISTENT`: los que fallan igual las seis veces— y el drenaje emite una
línea por cada uno y las devuelve en su informe, que es lo que responde el endpoint del cron.

El local se nombra por **`entidadId`, que para un evento `STORE` es el `Tienda.id`**, no por su
nombre. Un identificador es estable, no es dato de negocio y no arrastra al log el nombre comercial
de nadie: la regla de logging de F-002 (`logRouteError`) existe justamente para eso. Quien necesita
el nombre legible es el comerciante, y lo tiene en su pantalla por la pieza 1.

**3. No se toca la mecánica de reintentos.** Nada de aparcar el evento poniéndole `intentos` al
máximo, nada de un backoff propio, nada de marcarlo procesado. El criterio pide visibilidad, no un
mecanismo nuevo; y aparcarlo le quitaría al comerciante la recuperación natural, que es corregir el
calendario y guardar otra vez.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Que la ruta devuelva `403` con el código en el cuerpo | E-009: `axiosClient` sustituye el cuerpo de cualquier `403` y la pantalla recibe un mensaje de permisos falso. Inalcanzable, y no se ve leyendo la ruta |
| Devolver `502` con el código, como F-003 | Correcto para una llamada **síncrona** a queandabuscando (y es lo que hace el ADR 0033 para el slug). Aquí no hay llamada: el fallo ocurrió hace minutos, en un cron. La consulta del estado no falló — la lectura funciona perfectamente y devuelve una mala noticia |
| Reenviar `ultimoError` tal cual a la pantalla | Expone hasta 500 caracteres del cuerpo de un tercero en la interfaz del comerciante, y acopla la copia de la pantalla al formato de un mensaje de log |
| Marcar el evento como procesado al ser un fallo permanente | Lo contrario del criterio 12: «no se da por procesado» es literal. Y perdería la traza |
| Aparcar el evento poniendo `intentos = 6` | Ahorra cinco reintentos baratos a cambio de un estado nuevo que hay que saber deshacer. El spec dice explícitamente que el criterio pide algo *adicional* al reintento, no un mecanismo nuevo |
| Escribir el nombre del local en el log | Dato de negocio en un log que ya se peina para no llevar cuerpos ni parámetros. El `Tienda.id` nombra el local igual de bien y no envejece con un renombrado |
| Una tabla nueva de incidencias de sincronización | Duplica lo que `OutboxEvento` ya guarda (`intentos`, `ultimoError`, `procesadoAt`) y hay que mantenerla en coherencia con ella |

## Consecuencias

**A favor:**
- El criterio 7 se puede *ver* desde la aplicación, no solo desde la base de datos, y sin depender
  de un interceptor que hoy no lo permitiría.
- El criterio 12 se verifica ejecutando: se fuerza la respuesta, y el código aparece en la línea de
  log, en el informe del cron y en la pantalla del local afectado.
- Ningún cuerpo de queandabuscando llega al navegador. El enum cerrado es la frontera.
- El estado de sincronización sirve igual para los eventos que F-006 y siguientes añadan: el
  vocabulario y la función de normalización ya existen.

**En contra / coste asumido:**
- Un `200` que contiene una mala noticia obliga a la pantalla a mirar dentro. Es exactamente lo que
  el ADR 0022 rechazó para el alta de negocio — allí había una llamada síncrona que sí falló; aquí
  la lectura funciona y lo que se lee es un estado. La distinción está escrita para que no se
  confundan.
- `normalizeOutboxErrorCode` conoce los formatos que escribe F-002. Si esos formatos cambian, hay
  que tocarla; por eso son constantes compartidas (`QAB_OUTBOX_ERROR_CODES`) y no literales.
- Un código que no se reconozca cae en `UNKNOWN` y la pantalla dice «error de sincronización» sin
  más detalle. Preferible a filtrar el crudo.

**Impacto en seguridad y escalabilidad:**
- Enum cerrado en la respuesta: no puede filtrar lo que no está en él, ni cuerpos, ni cabeceras,
  ni el token.
- El estado se calcula **solo sobre las filas no procesadas** (`procesadoAt: null`) de los locales
  del negocio de la sesión, con `take` acotado: la consulta no crece con el histórico de eventos,
  que sí crece sin límite.
- Reversión inmediata: son campos de lectura derivados y una línea de log. Nada persistido nuevo,
  ninguna migración.
