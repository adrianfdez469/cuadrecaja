# ADR 0039: Los eventos agotados del outbox se borran bajo un TTL propio, más largo, medido desde `ocurridoAt`

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-019
**Relacionado:** [ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) ·
[ADR 0012](0012-indice-parcial-de-drenaje-del-outbox.md)

## Contexto

`OutboxEvento` tiene hoy tres estados observables, y solo dos de ellos envejecen:

| Estado | `procesadoAt` | `intentos` | Quién lo mueve |
|---|---|---|---|
| **Pendiente** | `NULL` | `< QAB_OUTBOX_MAX_ATTEMPTS` | El drenaje lo reclama en la próxima corrida |
| **Procesado** | fecha | cualquiera | Nadie: terminó bien |
| **Agotado** | `NULL` | `>= QAB_OUTBOX_MAX_ATTEMPTS` | **Nadie, nunca más** |

El estado agotado es el que crea el problema. El acuse del drenaje
(`drainQabOutbox`, `src/lib/qab/outboxDrain.ts`) escribe en fallo
`{ intentos: { increment: 1 }, ultimoError: message }` y en éxito
`{ procesadoAt: now(), ultimoError: null }`. Una fila que falla su sexto intento queda en
`intentos = 6`; la corrida siguiente ya no la reclama, porque `claimOutboxBatch` filtra
`intentos < ${QAB_OUTBOX_MAX_ATTEMPTS}`. A partir de ahí la fila **se congela**: `intentos` no vuelve
a subir, `procesadoAt` se queda en `NULL` para siempre y `ultimoError` conserva el último mensaje.

Y ahí está la trampa que este feature tiene que resolver. La regla obvia de una purga —«borrar lo que
tenga `procesadoAt` más viejo que el TTL»— **no alcanza jamás** a una fila agotada, porque su
`procesadoAt` es `NULL`: no envejece según esa regla, así que se acumula igual que si no hubiera
purga ninguna. El único sello de tiempo que esa fila tiene es `ocurridoAt`.

Hay dos cosas más que hay que tener delante antes de decidir, y ninguna es evidente leyendo el
modelo:

**1. El conjunto agotado no está acotado en la práctica.** Es tentador razonar que «solo llegan ahí
las que de verdad fallaron seis veces, y eso es raro». No lo es cuando el fallo es de
configuración, en vez de puntual. Un negocio con `tiendaOnlineHabilitada = true` y sin `qabToken`
entra en el lote (`claimOutboxBatch` solo exige el interruptor, no el token), y `drainQabOutbox` lo
acusa con `QAB_OUTBOX_ERROR_CODES.tokenMissing` para **todas** sus filas. Con el cron cada 2 minutos
y sin backoff (ADR 0011), esas filas queman sus seis intentos en unos doce minutos. O sea: en una
configuración a medias —el escenario del «token huérfano» que ya nombra el
[ADR 0023](0023-orden-del-alta-y-registro-del-token-huerfano.md)— **el 100 % de los eventos de ese
negocio acaba agotado**, no una fracción. Y F-006 emitirá `PRODUCT` por cada cambio de catálogo.

**2. Las filas agotadas viven dentro del índice que mantiene rápido al drenaje.** El predicado de
`idx_outbox_pendiente` (ADR 0012) es `WHERE "procesadoAt" IS NULL`, sin condición sobre `intentos`
—deliberadamente, para que el índice no se desactive en silencio si `QAB_OUTBOX_MAX_ATTEMPTS`
cambia—. Una fila agotada tiene `procesadoAt IS NULL`, así que **está indexada ahí**. El drenaje
recorre ese índice ordenado por `id` ascendente, y las filas agotadas son las de `id` más bajo (son
las más viejas): el escaneo tiene que leerlas y descartarlas antes de llegar a sus 500 filas útiles,
en **cada** corrida, cada dos minutos.

El propio ADR 0012 midió ese efecto, pero solo con **6 filas envenenadas** en la cabeza
(«las descarta con `Rows Removed by Filter: 6` y sigue usando el índice»). Nadie ha medido el
comportamiento con decenas de miles. Lo que sí se puede afirmar sin medir es la forma del coste: es
proporcional al número de filas agotadas acumuladas, y no lo paga la purga —lo paga el drenaje,
cada dos minutos, indefinidamente.

Conservar los agotados para siempre no es, entonces, «una tabla que engorda». Es una tabla que
engorda **y** un envenenamiento progresivo del único índice que hace sostenible el cada-2-minutos.

## Decisión

**Los eventos agotados se borran bajo un TTL propio, más largo que el de los procesados, medido
desde `ocurridoAt`.**

El criterio de selección de fila es, literal:

```sql
"procesadoAt" IS NULL
  AND intentos >= 6                      -- QAB_OUTBOX_MAX_ATTEMPTS, nunca el literal
  AND "ocurridoAt" < now() - INTERVAL '90 days'
```

Dos constantes nombradas en `src/constants/qab.ts`, ninguna en línea:

| Constante | Valor | Sobre qué columna mide |
|---|---|---|
| `QAB_OUTBOX_PROCESSED_TTL_DAYS` | `30` | `procesadoAt` |
| `QAB_OUTBOX_EXHAUSTED_TTL_DAYS` | `90` | `ocurridoAt` |

**Por qué 30 días para los procesados:** una fila procesada es la constancia de algo que sí llegó a
QAB. Su valor es poder reconstruir *qué se envió el mes pasado* durante una discrepancia de
catálogo; pasado ese plazo la respuesta está en el estado actual del catálogo, no en el histórico
del outbox. Treinta días acotan además la tabla y el índice de la fase procesada
(ADR 0041) a un mes de tráfico de catálogo, en vez de a todo lo emitido desde el despliegue.

**Por qué 90 días —el triple— para los agotados:** una fila agotada es lo contrario: la constancia
de un cambio que **nunca** llegó a QAB, con su `ultimoError` al lado. Es exactamente la evidencia
que hace falta cuando alguien pregunta por qué la tienda online muestra un precio viejo, y merece
una ventana más larga que un envío que salió bien. Noventa días cubren una revisión trimestral y
siguen acotando la cabeza envenenada de `idx_outbox_pendiente` a un trimestre en el peor caso, en
vez de a la vida del despliegue.

Los dos plazos son un punto de partida razonado, no medido contra tráfico real: F-005 acaba de
empezar a emitir y F-006 todavía no emite. Son dos constantes: subirlas o bajarlas cuando haya
volumen real es un cambio de una línea, sin migración y sin dato que convertir.

### Estado esperado exacto tras una corrida (especificación del criterio 5)

Esta es la parte que el `qa` debe usar como especificación literal. Cuatro filas sembradas, con
`now` = el momento de la corrida:

| Siembra | `intentos` | `procesadoAt` | `ocurridoAt` | Tras la corrida |
|---|---|---|---|---|
| A — agotada y vieja | `6` | `NULL` | `now - 120 días` | **Borrada.** `SELECT` por su `id` devuelve 0 filas |
| B — agotada y reciente | `6` | `NULL` | `now - 31 días` | **Sigue existiendo, tal cual.** Sus cuatro columnas sin cambiar |
| C — pendiente y vieja | `0` | `NULL` | `now - 120 días` | **Sigue existiendo, tal cual** (criterio 3) |
| D — procesada y vieja | cualquiera | `now - 31 días` | cualquiera | **Borrada** (criterio 2) |

La fila **B es la que discrimina** y no puede faltar (E-008): tiene `ocurridoAt` más antiguo que el
TTL de los procesados (30 días) y más reciente que el de los agotados (90). Solo sobrevive si la
purga aplica de verdad **dos** umbrales distintos; una implementación que aplicara un único TTL a
todo la borraría, y el criterio 5 pasaría igual sin la fila B.

Sobre el informe del endpoint: la fila A se cuenta en `exhausted.deleted`, la fila D en
`processed.deleted`. Contarlas en el mismo cajón no satisface este ADR.

### La frontera con el criterio 3, que no es una contradicción

El criterio 3 dice que «un evento con `procesadoAt` null NO se borra, por antiguo que sea». Este ADR
sí borra filas con `procesadoAt` null. **No se contradicen porque *pendiente* y *agotado* son
estados disjuntos**, separados por `intentos`:

- *Pendiente* es `procesadoAt IS NULL AND intentos < 6`: el drenaje la va a volver a tomar, así que
  borrarla destruye un cambio que todavía puede llegar a QAB. Nunca se toca.
- *Agotado* es `procesadoAt IS NULL AND intentos >= 6`: el drenaje ya no la va a tomar nunca, así
  que no hay nada que preservar salvo la evidencia — y eso es lo que acota el TTL de 90 días.

**Consecuencia práctica para quien verifique el criterio 3:** la fila que se siembre para ese
criterio debe tener `intentos < QAB_OUTBOX_MAX_ATTEMPTS` (el `@default(0)` del schema ya lo da si se
siembra sin nombrar la columna). Una siembra con `intentos = 6` no es «un evento pendiente muy
antiguo»: es la fila A de la tabla de arriba, y su comportamiento correcto es desaparecer.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Conservarlos indefinidamente** | Es la opción que parece más prudente y es la única que degrada el drenaje. Las filas agotadas están dentro de `idx_outbox_pendiente` (su predicado es solo `procesadoAt IS NULL`) y son las de `id` más bajo, así que el escaneo del drenaje las descarta una a una en cada corrida, cada 2 minutos, para siempre. Y el supuesto de que el conjunto es pequeño falla justo en el caso que importa: un negocio con el interruptor puesto y sin `qabToken` agota el 100 % de sus eventos en unos doce minutos. Se conservaría más evidencia de la que nadie va a mirar, al precio de la consulta más caliente de la integración. |
| **Archivarlos en una tabla nueva antes de borrarlos** | Mueve el problema en vez de resolverlo: la tabla de archivo crece sin límite y acaba necesitando su propia purga, con su propio ADR sobre qué hacer con sus filas viejas. Y cuesta una tabla, una migración y un modelo nuevos para conservar filas que hoy nadie lee: no existe ninguna pantalla ni informe que consulte los eventos agotados, y mientras no exista, archivar es escribir en un sitio que nadie abre. Si algún día hace falta esa visibilidad, lo que hará falta es una pantalla o una alerta —no un cementerio de filas—, y este ADR se reemplaza entonces con el requisito real delante. |
| **Archivarlos en un log estructurado antes de borrarlos** | Más barato que una tabla, pero el destino es peor: los logs de la función son efímeros (retención de días, no de meses) y agregan todos los negocios en un sitio. Escribir una línea por fila borrada convierte una corrida de purga en miles de líneas, y una purga que inunda los logs es una purga que alguien apaga. Lo que sí se hace, por eso, es **una línea agregada por corrida** con los conteos (§ del contrato sobre `logQabOutboxPurgeRun`): suficiente para notar «hoy se borraron 4000 agotados» sin convertir el log en el archivo. |
| **Un TTL único para procesados y agotados** | Simplifica el código y borra la evidencia de fallo con la misma prisa que la constancia de un éxito, que es exactamente lo que la nota del backlog advierte que no hay que hacer. La fila agotada es la que hay que poder mirar; la procesada, no. |
| **Medir el TTL de los agotados desde `ultimoError`** | No hay tal columna de fecha. El único sello de tiempo de una fila agotada es `ocurridoAt`; añadir un `agotadoAt` sería una columna nueva y una migración sobre `OutboxEvento` para un dato que `ocurridoAt` ya aproxima con un desfase acotado (con el cron cada 2 minutos y sin backoff, una fila se agota en el orden de minutos desde que se encoló). |
| **Reintentar los agotados en vez de borrarlos** | Es un feature distinto y probablemente deseable (un reintento manual desde una pantalla de administración), pero cambia el drenaje, que el alcance de F-019 excluye explícitamente. Y no resuelve el crecimiento: un token vencido hace fallar igual el reintento. |

## Consecuencias

**A favor:**
- La cabeza de `idx_outbox_pendiente` queda acotada por una ventana de tiempo (90 días) en vez de
  crecer con la vida del despliegue. El coste del drenaje deja de depender del histórico de fallos.
- La ventana de diagnóstico de un fallo de integración es explícita y está en una constante, en vez
  de ser un efecto lateral de que nadie borra nada.
- Las dos reglas son independientes: se puede alargar la de los agotados sin tocar la de los
  procesados, que es la que domina el tamaño de la tabla.

**En contra / coste asumido:**
- **Se destruye evidencia.** Una fila agotada de hace más de 90 días desaparece, y con ella el
  `ultimoError` que explicaba por qué un cambio no llegó a QAB. Es el coste que se acepta a cambio
  de no envenenar el drenaje, y la mitigación es parcial y hay que decirlo así: la línea agregada
  del log da el conteo, no el motivo.
- La visibilidad de fondo —que alguien se entere de que hay eventos agotados **antes** de los 90
  días— **este ADR no la resuelve**. Hoy solo `logQabPermanentFailure` avisa, y solo de los tres
  códigos de `QAB_OUTBOX_PERMANENT_ERROR_CODES`: un `QAB_TOKEN_MISSING` repetido seis veces no
  emite ninguna alerta. Queda como deuda nombrada, no como supuesto.
- Dos umbrales en vez de uno: dos fases de purga, dos constantes, dos casos de prueba y una fila de
  siembra (la B) sin la cual el criterio 5 pasaría con una implementación equivocada.
- Los valores 30 y 90 no están medidos contra tráfico real, porque ese tráfico no existe todavía.

**Impacto en seguridad y escalabilidad:**
- **Sin efecto sobre el aislamiento entre negocios.** Las dos reglas se aplican sobre columnas
  técnicas (`procesadoAt`, `intentos`, `ocurridoAt`) y no leen ni exponen ningún dato de negocio: el
  endpoint devuelve conteos agregados y ningún `negocioId` (ADR 0040).
- **Escalabilidad:** es la decisión que hace que el coste del drenaje deje de crecer con el
  histórico. Sin ella, `idx_outbox_pendiente` —cuyo argumento de diseño en el ADR 0012 era «no crece
  con el histórico»— sí crece, por la puerta de atrás de las filas agotadas.
- **Coste de reversión:** asimétrico y hay que saberlo. Cambiar los plazos es una constante; **lo
  borrado no vuelve**. Por eso el plazo de los agotados es el triple del de los procesados y no un
  valor apretado: el margen está del lado de conservar.
