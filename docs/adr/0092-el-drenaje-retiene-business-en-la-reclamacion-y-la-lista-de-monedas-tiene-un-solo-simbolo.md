# ADR 0092: El drenaje retiene `BUSINESS` en la reclamación, con la retención declarada y contada, y la lista de monedas tiene un solo símbolo

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-027
**Amplía:** [ADR 0091](0091-la-lista-de-monedas-es-una-entidad-de-negocio-y-el-tarifario-de-zonas-una-fila-con-un-discriminante.md)
**Se apoya en:** [ADR 0021](0021-el-interruptor-filtra-las-dos-fases-del-cron.md) ·
[ADR 0012](0012-indice-parcial-de-drenaje-del-outbox.md) ·
[E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) ·
[E-039](../../.agents/errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md)

## Contexto

El [ADR 0091](0091-la-lista-de-monedas-es-una-entidad-de-negocio-y-el-tarifario-de-zonas-una-fila-con-un-discriminante.md)
cerró, como parte de la negociación de la v12/v12.1 del contrato con queandabuscando, **qué** se
decide: la señal viaja en una entidad `BUSINESS` propia y no repetida en `STORE`; su `updatedAt` es
el instante en que cambió la lista y nunca un `max()`; y el drenaje tiene que filtrar esos eventos
hasta que el lado receptor esté en pie. Ese ADR **no se reescribe aquí**.

Lo que queda por decidir es el **cómo**, y son las tres cosas que un contrato de interfaces tiene
que fijar antes de que `implementer` y `dev-tester` empiecen a programar sin verse:

1. **Dónde** se filtra el evento retenido, cómo se enciende el día que QAB avise, y —lo que ninguno
   de los dos ADR anteriores cubre— **cómo se evita que un filtro temporal se convierta en un
   filtro olvidado**. Un evento que se encola para siempre y nunca sale es exactamente el fallo
   silencioso que este módulo lleva tres features intentando eliminar, y aquí se estaría
   introduciendo a propósito.
2. **Con qué símbolo** se fija el instante del `updatedAt`, dado que `NegocioMoneda` no tiene
   ninguna columna de tiempo.
3. **Dónde vive la definición** «la lista es `NegocioMoneda.activo` más `Negocio.monedaBase`», que
   ya tiene en el repositorio un vecino **parecido y distinto a propósito**:
   `useMonedasAlternativas` filtra por `activo`, descarta la base y descarta lo que no tiene tasa
   vigente. Ese último descarte no aplica a la lista del escaparate, y la diferencia es lo que se
   pierde en cuanto la definición se parafrasea dos veces (E-014 / E-039).

Tres restricciones del terreno, además de las tres que ya enumera el 0091:

- El **purgado** del outbox recoge dos clases de filas: las procesadas pasadas de fecha y las
  agotadas (`intentos >= QAB_OUTBOX_MAX_ATTEMPTS`). Una fila retenida no es ninguna de las dos, así
  que **no la recoge nadie**.
- `claimOutboxBatch` reclama `ORDER BY id LIMIT 500`, y ADR 0021 ya decidió que el interruptor de
  tienda online se filtra **ahí dentro**, con dos motivos escritos: reconocer esas filas quema los
  reintentos hasta expulsarlas para siempre, y dejarlas en el lote mata de hambre a los demás
  negocios.
- Las cuatro rutas que cambian la lista son las tres de moneda de negocio y
  `cambiar-moneda-base`, y **dos de ellas no eran transaccionales**: el `PUT` y el `DELETE` de
  `/monedas/[code]` hacían un `update` suelto y no emitían ningún evento QAB.

## Decisión

**Tres reglas.**

### 1. La retención es una lista declarada, se aplica en la reclamación, y cada corrida la cuenta

**Una constante y una derivada.** `QAB_OUTBOX_WITHHELD_ENTITIES` enumera las entidades que el
drenaje retiene; `QAB_OUTBOX_DRAINABLE_ENTITIES` se **deriva** de ella restándosela a
`QAB_OUTBOX_ENTITIES`. La reclamación usa la derivada. Así **no pueden discrepar**, y encender es
vaciar la primera: una edición de una línea, en un sitio.

**Se filtra en la reclamación**, con un predicado más en el `WHERE` de `claimOutboxBatch`, y no
después de que las filas vuelvan. El motivo es literalmente el de ADR 0021 y no una versión nueva
de él: filtradas después ocuparían el `LIMIT 500` y matarían de hambre a los demás, y reconocerlas
sería peor —o queman `intentos` hasta quedar fuera de la consulta para siempre, o se marcan
procesadas y el cambio se pierde en silencio—. Las filas retenidas quedan **intactas**: sin
`intentos++`, sin `ultimoError`, sin `procesadoAt`.

**El encendido, escrito junto a la constante:** quitar `QAB_BUSINESS_ENTITY` del array. Nada más;
ningún test fija ese valor ahí, a propósito, para que la promesa siga siendo cierta. El atasco
acumulado se reclama en la corrida siguiente en orden de `id`, que para esta entidad es también
orden de `updatedAt` —cada evento de un negocio es más nuevo que el anterior—, así que **todos se
aplican** y el último gana. La guarda anti-rancio cubre el otro orden: un evento que llegue tarde
por un reintento responde `stale`, que el contrato reporta en `ok` (§ Respuesta: todo lo que no sea
`failed` va en `ok`), y `planOutboxAck` lo marca procesado en vez de reintentarlo indefinidamente.
No hay reemisión ni limpieza manual en ninguno de los dos caminos.

**Y el mecanismo que hace que alguien se entere.** El informe del drenaje gana `withheld`: por cada
entidad retenida con atasco, **cuántos** eventos esperan y **desde cuándo**
(`oldestOcurridoAt`). Se lee dentro de la transacción del drenaje y **antes** del corte que
devuelve un informe vacío cuando la reclamación no trae filas — ese detalle es el mecanismo entero,
porque en el estado estacionario las filas retenidas son las **únicas** pendientes, la reclamación
vuelve vacía y un corte anterior a la lectura apagaría la alarma justo cuando importa. La cifra
sale en el cuerpo del cron de sincronización y además deja una línea de log por corrida
(`qab.outbox.withheld`, canal `warn`: la retención es deliberada, así que no es un error, y no es
rutina tampoco).

**La cifra es la alarma.** Crece monótonamente hasta que la lista se vacíe, y `oldestOcurridoAt` es
la edad del cambio más viejo que no salió. Un `pending` que lleva meses subiendo con un `oldest` de
hace meses es la forma visible de «esto se quedó puesto».

### 2. El `updatedAt` lo fija la ruta con un `new Date()` por petición, y sigue sin ser un `max()`

El instante se toma **una vez por petición**, con `new Date()` en la ruta, antes de abrir la
transacción, y se comparte entre `payload.updatedAt` y `OutboxEvento.ocurridoAt`. No es una
mecánica nueva: es exactamente lo que `POST /api/negocio/[id]/monedas` ya hace hoy para su evento
`CURRENCY`, con su comentario escrito, y es el camino de código con el que ya se cumple la v11 ②
para `EXCHANGE_RATE`. Cero columnas nuevas y ninguna lectura extra.

La regla de fondo —**la marca es el instante en que cambió la lista, y explícitamente no el máximo
de las marcas de las filas que la componen**— es la del [ADR 0091](0091-la-lista-de-monedas-es-una-entidad-de-negocio-y-el-tarifario-de-zonas-una-fila-con-un-discriminante.md)
§ 1, con su mecánica completa: retirar una moneda **baja** el máximo, el evento legítimo que sigue
llega con una marca **menor** que la guardada, QAB responde `stale`, y **la retirada no se aplica
nunca sin que nada falle**. Aquí no se reformula: se cita, y se le añade lo único que le falta —el
sitio.

**El aviso que hay que dejar escrito por adelantado:** hoy `NegocioMoneda` no tiene ninguna columna
de tiempo, así que el `max()` no se puede ni escribir. **El día que alguien añada un `updatedAt` a
esa tabla, el `max()` va a parecer la implementación obvia**, y va a coincidir con la instrucción
que llevan las otras cuatro entidades con guarda («el `updatedAt` de la fila de origen»). No lo es:
en `BUSINESS` no hay fila de origen porque la lista es un conjunto. Quien añada esa columna tiene
que leer este párrafo antes de tocar el payload.

**Lo que se acepta y no se mitiga:** `new Date()` tiene resolución de milisegundo y la guarda del
otro lado es `<=`, así que dos mutaciones de la lista del **mismo** negocio dentro del mismo
milisegundo producirían marcas iguales y la segunda respondería `stale`. No se implementa ningún
ajuste monótono contra la última marca emitida: costaría una lectura en cada mutación para
defender una ventana que exige dos escrituras de configuración del mismo negocio en el mismo
milisegundo. El día del encendido (§ 1) es el momento de revisarlo, con el atasco real delante.

### 3. La definición de la lista vive en un símbolo, y su vecino del POS no se unifica con él

`buildQabDisplayCurrencies`, función pura en `src/lib/qab/qabBusinessPayload.ts`, **es** la
definición: las activas más la base, filtradas por forma de código, sin duplicados y ordenadas. Su
bloque de documentación es el **único** enunciado normativo de la regla en todo el repositorio. El
contrato de interfaces, este ADR y cualquier consumidor futuro la **nombran**; no la vuelven a
escribir con otras palabras (E-014 / E-039).

Tres consecuencias concretas de que sea un solo símbolo, y las tres son elecciones:

- **El filtro `activo` no está en ningún `where` de Prisma.** El emisor lee **todas** las filas
  `NegocioMoneda` del negocio, activas e inactivas, y la función filtra. Poner `activo: true` en la
  consulta sería la segunda copia de la mitad más fácil de olvidar de la definición.
- **No hay ningún campo de tasa en la entrada.** La garantía «la lista no se poda por falta de
  tasa» no se sostiene con un test verde: se sostiene con la forma del tipo, que hace que el test
  que probaría la poda no se pueda ni escribir. Es la guarda de forma del criterio 4 y la
  prohibición de podar por tasas conviviendo sin pisarse, que es como se redactó el contrato a
  petición nuestra.
- **La función descarta, no rechaza.** Un código mal formado se cae de la lista y el resto viaja;
  no hay `QabBusinessPayloadError`. Es la asimetría deliberada con `buildQabCurrencyPayload` y
  `buildQabStorePayload`, que sí lanzan: ahí un dato malo invalida el evento entero, y aquí un
  código malo invalidaría **la lista de todas las demás monedas**. QAB hace lo mismo desde su lado
  —un miembro mal formado devuelve `BUSINESS_DISPLAY_CURRENCIES_INVALID` en `failed[]` y el resto
  del lote se aplica—, así que los dos lados degradan igual.

**`useMonedasAlternativas` se queda como está y no se unifica.** Responde otra pregunta —«en qué
otras monedas puede el POS enseñarle este importe a quien está delante ahora mismo»—, y por eso
descarta la base y descarta lo que no tiene tasa vigente. La lista del escaparate incluye la base y
es indiferente a la tasa. Hay **una diferencia en cada dirección**, así que ninguna de las dos se
deriva de la otra, y las dos definiciones se citan mutuamente en su documentación para que el
siguiente lector no «arregle» una convirtiéndola en la otra.

**Y una decisión de identidad que hacía falta fijar:** el `entidadId` de una fila `BUSINESS` es el
`Negocio.id`, el mismo valor que su columna `negocioId`. En las otras cinco entidades `entidadId`
es la identidad de la cosa que el payload describe; lo que un `BUSINESS` describe es el negocio. La
duplicación es a propósito: es lo que hace que `@@index([entidad, entidadId])` responda «los
eventos `BUSINESS` de este negocio». Y `operacion` es **siempre** `"UPDATE"`: `CREATE` y `UPDATE`
hacen lo mismo porque la lista viaja completa, y un `DELETE` se rechaza con
`BUSINESS_DELETE_NOT_SUPPORTED` — no existe la mutación que lo pediría, porque ningún endpoint de
este repositorio borra de verdad una fila `NegocioMoneda`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Filtrar `BUSINESS` **después** de la reclamación, en `groupOutboxEventsByNegocio` o en `toQabCatalogBatch` | Las filas ocuparían el `LIMIT 500` y matarían de hambre a los demás negocios, y habría que reconocerlas de algún modo: marcarlas procesadas **pierde el cambio en silencio**, y dejarlas pendientes tras reconocerlas les quema los seis intentos. Es la decisión que ADR 0021 ya tomó para el interruptor, por los mismos dos motivos |
| No emitir nada hasta que QAB avise, y hacer el feature entero después | Deja el trabajo a medias esperando un aviso de otra organización, y con él los cuatro puntos de mutación sin conectar. Los nueve criterios se verifican leyendo filas de `OutboxEvento`, así que el feature **se puede cerrar entero ahora** (ADR 0091 § 2) |
| Una variable de entorno como interruptor en vez de una constante | Un interruptor que se puede encender sin desplegar suena mejor y aquí es peor: el día que se enciende hay que **mirar el atasco**, y una variable permite encenderlo sin que nadie lea el procedimiento. Además añade una tercera fuente de verdad a un módulo que ya tiene `QAB_API_BASE_URL` y el interruptor por negocio |
| Un test que fije `"BUSINESS"` en la lista de retenidas, para que el encendido rompa la suite | El único que se enteraría es quien enciende el interruptor a propósito, que ya lo sabe. Y contradice la promesa escrita junto a la constante —«quitarlo del array, nada más»—, que es justo la clase de contradicción entre dos registros del mismo documento que produjo E-030. La invariante que sí se testea es la **derivación**, que sobrevive al encendido |
| Coalescer: cancelar o borrar los `BUSINESS` pendientes de un negocio al encolar uno nuevo | Acotaría el atasco a una fila por negocio, y es lo que el propio contrato sugiere para `EXCHANGE_RATE`. Pero el criterio 8 exige **dos** filas para dos cambios consecutivos, y son la forma ejecutable de que el `updatedAt` no sea un `max()`. Borrar la primera dejaría el criterio sin nada que leer. Queda como candidata **para el día del encendido**, cuando el atasco sea un número medido y no una hipótesis |
| Podar la lista como hace `useMonedasAlternativas`, reutilizando ese hook o su regla | Descarta lo que no tiene tasa vigente, y eso convertiría en invisible en el escaparate una moneda que el comerciante habilitó a propósito. El contrato lo prohíbe explícitamente y el criterio 4 lo verifica. Reutilizarlo «porque ya existe» es la forma de E-014 que este ADR viene a cerrar |
| `entidadId` con un literal fijo (`"self"`, `"-"`, cadena vacía) | El `@@index([entidad, entidadId])` deja de discriminar —todas las filas `BUSINESS` de la plataforma comparten clave— y la cadena vacía además no parsea: `entidadId` es `z.string().min(1)` |
| Que el emisor reciba las filas de `NegocioMoneda` y la base como argumentos, en vez de leerlas él | El caller podría pasarle el estado **anterior** a la mutación sin que nada falle, y en `cambiar-moneda-base` esa es la equivocación natural: la conversión de precios ocurre antes del `update` del negocio. Leyéndolas él dentro de la transacción, la única forma de equivocarse es llamarlo antes del `update`, que es lo que el contrato señala |
| Emitir el evento en cualquier `PUT`/`DELETE`, sin comparar el `activo` anterior | Es más simple y no es incorrecto —el payload es idempotente—, pero mete filas en una cola que hoy **no se drena**, y el atasco es justo la cifra que sirve de alarma. La regla «se debe un evento cuando el conjunto cambió» sale igual de barata: una lectura por clave primaria dentro de la transacción |

## Consecuencias

**A favor:**

- El feature se cierra entero, verificado leyendo filas, **antes** de que el lado receptor exista, y
  sin arriesgar el lote de nadie.
- Encender es una edición de una línea, con el procedimiento escrito en el mismo sitio que la
  constante y en este ADR, diciendo los dos lo mismo.
- La retención **se ve desde fuera** en cada corrida del cron, con un número que crece y una fecha
  que envejece. No depende de que nadie recuerde nada.
- La definición de la lista tiene un dueño y un solo enunciado normativo, y su vecino del POS
  quedó explicado en lugar de unificado por error.
- El `PUT` y el `DELETE` de `/monedas/[code]` pasan a ser transaccionales, que es lo que hacía
  falta para que su evento no pueda quedar escrito sin su mutación.

**En contra / coste asumido:**

- **Las filas retenidas no las purga nadie.** El purgado recoge procesadas pasadas de fecha y
  agotadas por `intentos`; una fila retenida tiene `intentos = 0` y `procesadoAt` nulo. Crecen a
  razón de una fila por cambio de la lista y por negocio —una acción de configuración, no de
  venta—, y cada reclamación pasa por encima de ellas con ids bajos. Es el mismo coste que ADR 0021
  ya aceptó para las filas de un negocio apagado, y ahora está **contado**.
- **Una lectura de agregación por corrida del drenaje**, dentro de su transacción, cuyo coste crece
  con el atasco que mide. Es aceptable precisamente porque ese crecimiento es la señal.
- **Una lectura extra de `Negocio` por emisión**: el interruptor por un lado y `monedaBase` por
  otro, dos búsquedas por clave primaria en vez de una. Se paga por tener **una** definición del
  interruptor, compartida con los cuatro emisores hermanos.
- **La ventana del milisegundo** del § 2 queda abierta, documentada y sin mitigar.
- Un negocio que reactive una moneda por el `PUT` puede acabar con un código en
  `displayCurrencies` sin haber emitido su `CURRENCY`, porque el bootstrap solo está en el `POST`.
  Queda **anotado y fuera de alcance** en el contrato de interfaces: el contrato v12.1 dice que una
  moneda de la lista sin `CURRENCY` ni `EXCHANGE_RATE` no hace fallar el evento —se guarda y no se
  pinta hasta tener tasa—, así que degrada, no rompe. Corresponde a un feature propio.

**Impacto en seguridad y escalabilidad:**

- El emisor lleva `negocioId` en **las dos** lecturas, y la mutación de las tres rutas de moneda
  entra por `@@unique([negocioId, monedaCode])`, así que el acotado por tenant es estructural y no
  una comprobación posterior. Las cuatro rutas siguen detrás de `assertNegocioConfigAccess`, que ya
  exige pertenencia al negocio del path más el permiso de configuración avanzada.
- `negocioId`, `entidadId` y `payload.businessId` salen del **mismo parámetro**. El coste de
  equivocarse no sería una fuga de lectura: sería que el lote de **otro** negocio se rechazara
  entero con `403 BUSINESS_MISMATCH`, que es el fallo que el comentario de `planQabCategoryCascade`
  ya describe.
- El payload lleva un `businessId`, códigos de moneda de ese negocio y un instante. La única cifra
  global del feature —el atasco retenido— es un nombre de entidad, un contador y una fecha: sin
  `negocioId`, sin `entidadId` y sin payload, igual que el resto de los logs de este módulo.
- El evento es **uno por negocio** y no uno por sucursal: habilitar una moneda encola una fila,
  no tantas como locales tenga la marca.
- La lista se recalcula entera en cada emisión leyendo las filas de un solo negocio —unidades, no
  miles—, así que no hay N+1 ni recorrido histórico que paginar.
