# ADR 0011: Reintentos del outbox sin backoff, corte en 6, y qué se escribe en `ultimoError`

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-002

## Contexto

El contrato de queandabuscando fija el corte y su porqué en `§①`:

> *"`intentos < 6` es lo que impide el bloqueo de cabeza de línea: un payload corrupto se queda
> quieto después de 6 intentos y los siguientes siguen fluyendo. El acuse es **por id**, nunca por
> lote."*

Y el criterio 5 de F-002 lo traduce a algo verificable: *"Un evento cuyo POST falla queda con
`procesadoAt` null e `intentos` incrementado; al llegar a 6 deja de tomarse y los posteriores siguen
fluyendo."*

Quedan tres cosas sin decidir:

1. **¿Qué cuenta `intentos`?** ¿Envíos, o fallos? La diferencia decide si un evento acusado a la
   primera deja rastro.
2. **¿Hay backoff?** Sin ninguna espera, el corte en 6 se agota en **10 minutos** de crons cada 2.
3. **¿Qué se guarda en `ultimoError`?** Es la única pista que quedará cuando un evento muera.

El punto 2 tiene un filo que conviene ver antes de decidir: la guarda de 6 intentos está pensada
contra un **payload corrupto**, pero una caída de QAB de más de diez minutos gastaría los seis
intentos de **todo lo pendiente** y lo mataría en bloque. Sería un fallo silencioso de la
integración entera provocado por una avería del otro lado. Y el spec, en su sección de
ambigüedades, ya interpretó el criterio 5 como que **los dos casos —la petición completa que falla
y el evento reportado en `failed`— incrementan `intentos` igual**.

Restricción dura: F-002 no puede crear columnas, así que no hay dónde guardar un
`proximoIntentoAt` ni un `ultimoIntentoAt`. No hay materia prima para un backoff por fila.

## Decisión

**`intentos` cuenta fallos, no envíos. No hay backoff: cadencia fija de 2 minutos y corte en
`QAB_OUTBOX_MAX_ATTEMPTS`. Y `ultimoError` lleva un prefijo de código legible por máquina que
distingue el fallo de transporte del payload corrupto.**

Tabla de verdad de `planOutboxAck`, vinculante:

| Caso | `procesadoAt` | `intentos` | `ultimoError` |
|---|---|---|---|
| La petición entera falla (red, timeout, o cualquier estado ≠ 207) | sigue `null` | `+1` | `TRANSPORT:…` / `HTTP:<status>:…` |
| Cuerpo del 207 ilegible o que no valida | sigue `null` | `+1` | `INVALID_RESPONSE_BODY:…` |
| El id viene en `response.ok` | `now()` | **sin tocar** | `null` |
| El id viene en `response.failed` | sigue `null` | `+1` | `EVENT:<error>` |
| El id no viene en ninguna de las dos listas | sigue `null` | `+1` | `MISSING_IN_RESPONSE` |
| El negocio no tiene `qabToken` | sigue `null` | `+1` | `QAB_TOKEN_MISSING` |

Tres consecuencias de forma:

- **Un evento acusado a la primera queda con `intentos = 0`.** «Intentos» se lee como «intentos
  fallidos», que es lo que la guarda de cabeza de línea necesita contar. Un evento con `intentos`
  alto es, por definición, un evento problemático: la columna es directamente un indicador.
- **`ultimoError` se trunca a `QAB_OUTBOX_ERROR_MAX_LENGTH` (500)** y colapsa los espacios en
  blanco. Una traza de QAB de veinte kilobytes no infla la tabla ni el drenaje siguiente.
- **El prefijo no es cosmético.** Es lo que permitirá que un trabajo de reparación futuro distinga
  «murió por un payload que nunca va a funcionar» (`EVENT:`, `HTTP:400`) de «murió porque QAB estuvo
  caído media hora» (`TRANSPORT:`, `HTTP:503`) y resucite solo lo segundo. Sin el prefijo esa
  distinción se pierde para siempre en el momento del fallo.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Backoff exponencial por fila | Necesita `proximoIntentoAt` o `ultimoIntentoAt`. F-002 no crea columnas y F-001 ya cerró su migración. Es la opción correcta a medio plazo, no hoy. |
| Derivar el backoff de `ocurridoAt + f(intentos)` sin columna nueva | Aritméticamente posible y **equivocado**: `ocurridoAt` es cuándo pasó el cambio, no cuándo se intentó enviarlo. Un evento que estuvo tres días en la cola quedaría inmediatamente vencido de todos sus reintentos. |
| **No** incrementar `intentos` cuando falla la petición entera, solo cuando el evento viene en `failed` | Es la opción que mejor protege de una caída de QAB —la guarda quedaría reservada para lo que de verdad es un payload corrupto, que es lo que el contrato dice que protege—. Se descarta porque **el criterio 5 y la interpretación que el spec ya fijó dicen lo contrario, y un criterio de aceptación no se reinterpreta desde arquitectura.** Queda anotada como la primera candidata si el corte en bloque llega a ocurrir de verdad. |
| Enum de estados en `ultimoError` en vez de texto libre con prefijo | Los errores de QAB son texto libre por contrato; forzarlos a un enum perdería el detalle justo cuando hace falta. El prefijo da lo mejor de los dos: clasificable por máquina, legible por humano. |
| Subir el corte de 6 a un número mayor para sobrevivir caídas largas | El 6 es del contrato, no nuestro. Cambiarlo unilateralmente desincroniza los dos lados. |
| Cola de mensajes muertos (DLQ) en tabla propia | Los modos de falla del contrato la mencionan (`intentos > 5 → DLQ + alerta`), pero es una tabla nueva. `intentos >= 6` **es** la DLQ: son filas que siguen ahí, consultables, sin borrar. La alerta es de otro feature. |

## Consecuencias

**A favor:**
- El criterio 5 se cumple literalmente y es verificable con una consulta SQL.
- La cabeza de línea nunca se bloquea: comprobado ejecutando sobre 600 pendientes de las que 6
  tenían `intentos = 6` — la corrida se llevó las 500 siguientes y el plan las descartó por el
  filtro, con el índice haciendo `Rows Removed by Filter: 6`.
- Cero columnas nuevas, cero estado adicional que mantener.
- Un evento muerto conserva su causa clasificada, no un mensaje suelto.

**En contra / coste asumido:**
- **Un corte de QAB de más de 10 minutos mata todo lo pendiente en ese momento**, y resucitarlo
  exige un `UPDATE "OutboxEvento" SET intentos = 0 WHERE …` a mano. Es el coste real de esta
  decisión y hay que decirlo con todas las letras. Lo que lo hace tolerable: la reconciliación
  diaria del contrato (`§⑤`) detecta la divergencia, y el prefijo `TRANSPORT:`/`HTTP:5xx` deja
  identificable exactamente qué filas resucitar. **Antes de que F-005 y F-006 emitan tráfico real
  conviene abrir un feature de reparación** que lo automatice.
- Sin backoff, un QAB caído recibe una petición cada 2 minutos por negocio pendiente. Es tráfico
  despreciable, pero no es cero.

**Impacto en seguridad y escalabilidad:**
- **Aislamiento:** el acuse es por id y solo sobre las filas que esta corrida envió —
  `planOutboxAck` ignora cualquier id de `ok`/`failed` que no estuviera en el lote. Una respuesta
  defectuosa o maliciosa de QAB no puede marcar como procesada una fila de otro negocio. Es una
  propiedad comprobable en un test unitario, sin base de datos.
- `ultimoError` guarda un fragmento del **cuerpo de la respuesta**, nunca de la petición: el token
  va en la cabecera de salida y no puede acabar en la columna.
- El truncado a 500 caracteres acota el crecimiento de la tabla ante un error repetitivo verboso.
- **Reversión:** cambiar la política más adelante es un cambio local a `planOutboxAck`, una función
  pura. No hay datos que migrar.
