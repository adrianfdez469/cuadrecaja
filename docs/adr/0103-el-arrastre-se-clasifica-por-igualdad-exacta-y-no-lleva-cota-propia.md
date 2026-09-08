# ADR 0103: El arrastre se clasifica por igualdad exacta del código, y su terminación la sostiene la dependencia sin cota propia

**Estado:** aceptado
**Fecha:** 2026-09-07
**Feature:** F-028 (parte B)
**Se apoya en:** [ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) ·
[ADR 0043](0043-el-orden-de-emision-se-sostiene-por-el-orden-de-insercion-en-el-outbox.md) ·
[ADR 0102](0102-un-arrastre-de-dependencia-es-una-tercera-disposicion-del-acuse-no-un-estado-de-la-fila.md) ·
[E-017](../../.agents/errors/E-017-un-absoluto-en-un-contrato-que-el-codigo-no-sostiene.md) ·
[E-023](../../.agents/errors/E-023-medir-un-plan-sobre-una-tabla-que-no-tiene-las-filas.md) ·
[E-031](../../.agents/errors/E-031-el-mensaje-de-un-error-de-runtime-cita-el-cuerpo.md) ·
[E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md) ·
[E-039](../../.agents/errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md) ·
[E-049](../../.agents/errors/E-049-deducir-una-clasificacion-de-la-forma-del-identificador.md)

## Contexto

El [ADR 0102](0102-un-arrastre-de-dependencia-es-una-tercera-disposicion-del-acuse-no-un-estado-de-la-fila.md)
decide **qué** es un arrastre: una tercera disposición que no escribe nada. Quedan dos preguntas de
**cómo**, y la segunda es la que el spec dejó abierta expresamente.

### 1. Cómo se reconoce un arrastre

Hay dos precedentes en el mismo archivo, y **hacen cosas distintas**:

- `collectQabPermanentFailures` (`src/lib/qab/outboxAck.ts`) busca su código con
  `entry.error === candidate || entry.error.includes(candidate)` — es decir, **también por
  subcadena**.
- `planOutboxAck` no clasifica nada: escribe el error tal cual, prefijado y truncado.

Copiar el primero sería lo cómodo. Y sería un error de una clase con nombre: una guarda **más ancha
que la del contrato** (E-032). La diferencia importa porque las dos clasificaciones tienen
consecuencias opuestas: reconocer de más un fallo permanente solo añade una línea de log; reconocer
de más un arrastre hace que un evento **deje de gastar intentos** y, con ello, que la guarda de
cabeza de línea del [ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) deje de aplicársele.

Lo que el contrato dice, verificado abriéndolo: la fila `207` de `DEPENDENCY_FAILED_IN_BATCH` de
`sync-contract.md` (v12.1, § «Errores») publica el cuerpo como
`"failed":[{"id":"...","error":"DEPENDENCY_FAILED_IN_BATCH"}]` — el código **es** el valor entero
del campo, no un prefijo ni un fragmento. Y verificado en el código del lado receptor: el `error` de
cada entrada de `failed[]` es el `message` de la excepción, que para este caso es la constante
sola, y sus propios tests lo afirman con una igualdad exacta.

**Y una observación del spec que ahorra trabajo:** la clasificación es **por código de error, no por
entidad**. Este lado no necesita saber cuáles son las parejas de dependencia. Quien decide, lote a
lote, qué eventos cuentan como arrastrados es QAB; la definición de las parejas vive en
`sync-contract.md` § «Cambios respecto a la v10.1» ③ y **no se copia aquí** (E-039), porque una
copia se queda vieja en silencio. Deducir el arrastre de la entidad —«si es un `PRODUCT` y hay un
`CATEGORY` fallido en el lote, entonces…»— sería además reconstruir localmente una relación que
vive en el `payload` y no en la clave del outbox, que es la forma de E-049.

### 2. Qué detiene un reintento indefinido

Esta es la pregunta abierta que el spec **no resuelve**. El
[ADR 0011](0011-reintentos-del-outbox-sin-backoff.md) eligió el corte de 6 citando el contrato:

> *"`intentos < 6` es lo que impide el bloqueo de cabeza de línea: un payload corrupto se queda
> quieto después de 6 intentos y los siguientes siguen fluyendo."*

Una fila que no gasta intentos queda, en principio, fuera de esa guarda. El dato que acota el
problema, verificado en `claimOutboxBatch`: la **dependencia** (`CATEGORY`, `CURRENCY`) sigue
gastando **sus** intentos con la mecánica sin cambios, así que al llegar a
`QAB_OUTBOX_MAX_ATTEMPTS` deja de reclamarse, deja de viajar en el lote, y la cascada deja de
producirse por sí sola. El spec deja abierto si ese límite implícito **basta**.

## Decisión

**El arrastre se reconoce por igualdad exacta (`===`) del `error` recibido contra los miembros de
una lista cerrada propia, `QAB_OUTBOX_DEFERRED_ERROR_CODES`, y NO se añade ninguna cota propia al
dependiente: la terminación la sostiene la dependencia, y la guarda contra el silencio es la
visibilidad.**

### 1. Igualdad exacta, y nada más

```
matchQabOutboxDeferralCode(error) = el miembro de QAB_OUTBOX_DEFERRED_ERROR_CODES
                                    tal que error === miembro, si existe
```

Sin `includes`, sin `startsWith`, sin `trim`, sin normalizar mayúsculas y sin expresiones
regulares. Cinco consecuencias que se siguen de eso, y las cinco son deliberadas:

1. **Un `error` que *contenga* el código pero no sea el código no es un arrastre.** Sigue por la
   fila normal del ADR 0011: `intentos + 1` y `EVENT:<error>`. Si algún día QAB empieza a añadir
   detalle al código, este lado deja de reconocerlo y **vuelve al comportamiento de hoy** —gastar
   intentos—, que es un fallo hacia el lado conservador y no hacia el peligroso.
2. **La lista es cerrada y propia.** Es el vocabulario de «no gasta intento», y es una lista
   **distinta** de `QAB_OUTBOX_PERMANENT_ERROR_CODES`: «no permanente» y «no cuenta» son dos
   clasificaciones diferentes, y hoy los seis códigos de `QAB_OUTBOX_ERROR_CODES` son ejemplos de
   no-permanentes que **sí** cuentan. Juntarlas en una lista sería confundirlas.
3. **Lo que se propaga es la constante, no la cadena recibida.** La función devuelve el **miembro de
   la lista** que casó, y es ese valor el que viaja al log y al informe. La cadena que vino del
   cable muere en la comparación. No es una regla que haya que recordar: es la firma.
4. **La comparación no puede lanzar.** `===` entre dos cadenas no tiene modo de fallo. No hay
   `JSON.parse`, no hay `BigInt(<cadena>)`, no hay `Number()`, no se trunca y no se interpola en
   ningún mensaje: las vías que E-031 documenta para que el runtime fabrique un mensaje **citando el
   dato que lo rompió** no existen en este camino. E-031 llegó a tres apariciones justamente por
   ahí —el `JSON.parse` del pull y el `SyntaxError` de `BigInt`—, así que no es una precaución
   teórica.
5. **`entry.error` llega validado.** `qabCatalogSyncResponseSchema` (`src/schemas/qabSync.ts`) lo
   declara `z.string()` y `postQabCatalogBatch` valida el cuerpo del 207 antes de devolverlo, así
   que la clasificación nunca recibe un `undefined` ni un número. No se revalida: se confía en la
   frontera que ya existe, igual que `claimOutboxBatch` declara para las filas.

### 2. Ninguna cota propia del dependiente, y por qué la cabeza de línea no se bloquea

La guarda del ADR 0011 existe contra **el bloqueo de cabeza de línea**. En este sistema eso es algo
mecánico y concreto: `claimOutboxBatch` toma `ORDER BY o.id LIMIT QAB_OUTBOX_BATCH_SIZE` sobre las
filas con `procesadoAt IS NULL AND intentos < QAB_OUTBOX_MAX_ATTEMPTS`. Bloquear la cabeza es
ocupar indefinidamente las posiciones de menor `id` y dejar sin sitio a las de `id` mayor.

**La demostración, y se apoya en una propiedad estructural, no en una estimación:**

**Una fila arrastrada nunca puede ser la cabeza de la línea.** El contrato arrastra solo **dentro
del mismo lote** y solo **hacia adelante** —lo dice al presentar la cascada, y lo verifica su propio
código, que recorre los eventos en el orden en que llegan y bloquea un evento por otro **anterior**
del mismo recorrido—. El lote viaja en orden ascendente de `id`: `claimOutboxBatch` ordena por `id`,
`groupOutboxEventsByNegocio` conserva ese orden dentro de cada negocio y `toQabCatalogBatch` lo
mapea posición a posición. Por lo tanto, **para toda fila arrastrada existe, en el mismo lote, otra
fila de `id` menor que falló por su cuenta** — y esa fila **sí** gasta su intento y **sí** está
gobernada por el corte de 6.

De ahí se sigue lo que el ADR 0011 pide: quien ocupa la cabeza de la línea es siempre una fila
sujeta a la guarda de los seis intentos. La fila arrastrada va **detrás** de ella, y deja de ser
arrastrada en cuanto la de delante se aplica (se procesa y desaparece) o se agota (deja de
reclamarse). En los dos desenlaces la cascada cesa, y el dependiente pasa a recibir una disposición
terminal —`ok`, o `failed` con su propio error y su propio `intentos + 1`—.

**El número de arrastres que una fila puede acumular está acotado por lo que hay delante:** cada
fila de dependencia pendiente puede causar como mucho `QAB_OUTBOX_MAX_ATTEMPTS` arrastres antes de
agotarse, y un `PRODUCT` depende de una sola categoría, una `EXCHANGE_RATE` de una sola moneda. La
cuenta solo sigue creciendo si **llegan filas de dependencia nuevas**, es decir si el comerciante
sigue editando esa categoría, y en ese caso el trabajo pendiente no es un atasco: es trabajo real
que aún no se ha aplicado.

**Y lo que esta decisión NO sostiene, dicho sin adornos (E-017):** si QAB emitiera el código en un
caso que **no** es una cascada real —un fallo suyo, un cambio futuro de su comportamiento, o un
servidor hostil ocupando la URL— una fila podría quedar exenta indefinidamente, sin que ningún
contador la frene. Este ADR no elimina ese caso. Lo que hace con él es **volverlo ruidoso**:

- una línea `warn` por arrastre y por corrida (`logQabOutboxDeferral`), y
- una entrada por arrastre en `IQabOutboxDrainReport.deferrals`.

Una fila exenta para siempre aparece en cada corrida, cada dos minutos, con su `eventId`. Eso es lo
contrario de lo que hoy pasa —hoy el evento muere callado a la sexta— y es la propiedad que hace
tolerable no tener cota: el modo de fallo es **visible**, no silencioso.

### 3. Por qué no una cota explícita

No es una preferencia de estilo, es un cálculo de coste:

- **Contar arrastres por fila exige estado persistente por fila**, o sea una columna nueva: el mismo
  coste completo que el [ADR 0100](0100-cancelar-un-exchange-rate-superado-borra-la-fila-y-no-anade-un-estado-al-outbox.md)
  descartó —migración, filtro nuevo en la consulta más caliente, fase nueva de purga, vocabulario
  nuevo para el censo entero—, y aquí a cambio de defenderse de un fallo del otro lado.
- **Una cota por corrida** («solo N arrastres exentos por corrida») castigaría el caso legítimo, que
  es el más probable: una categoría con trescientos productos detrás.
- **Una cota por antigüedad** (`ocurridoAt` más viejo que X deja de estar exento) no necesita
  columna, pero mataría al dependiente por esperar, que es exactamente el fallo que este feature
  arregla, solo con un plazo más largo.
- **Añadir la cota más tarde es un cambio local a una función pura.** Es la opción reversible, y
  entre dos diseños defendibles se elige el reversible.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Reconocer el código con `includes`, como `collectQabPermanentFailures` | Guarda más ancha que la del contrato (E-032). Y la asimetría de coste lo decide: aquí un falso positivo **retira** la guarda de los seis intentos, no solo añade una línea de log. El contrato publica el código como el valor entero del campo |
| Un solo constante suelta (`QAB_OUTBOX_DEPENDENCY_DEFERRAL_CODE = "…"`) en vez de una lista cerrada | Funciona hoy, con un único código, y no deja sitio para el segundo sin cambiar todas las firmas. La lista cerrada además permite derivar el tipo del campo `code` con `z.enum`, igual que `qabPermanentFailureSchema` |
| Deducir el arrastre localmente: buscar en el lote un `CATEGORY` fallido cuyo id sea menor que el del `PRODUCT` | Reimplementa de este lado una decisión que es del otro, duplicando una definición que ya existe (E-039), y necesita leer el `payload` para saber qué producto depende de qué categoría —el `entidadId` de un `CATEGORY` es el id de la categoría y el de un `PRODUCT` es el `ProductoTienda`, así que no hay forma de relacionarlos por la clave del outbox—. Es E-049: clasificar por la forma del identificador |
| Una cota explícita por fila, con columna | El coste del ADR 0100 entero, para defenderse de un fallo del otro lado. Y rompería el criterio 7, que pide que el arrastrado siga en cero «por muchas veces que se le arrastre» |
| Una cota por corrida o por antigüedad | Castigan el caso legítimo (una categoría con muchos productos detrás; un dependiente que espera mucho pero espera bien) |
| Confiar en el límite implícito **y no loguear nada** | Es la opción que el spec teme con razón: si la clasificación se equivoca o QAB cambia, nada avisa. La visibilidad es la parte que convierte «basta» en una afirmación defendible |
| Alertar además por `Notificacion`, como hace F-008 con la reconciliación | Es un mecanismo de otro feature y no está en ningún criterio de F-028. Si el log llega a mostrar arrastres persistentes, se abre un feature propio; no se anticipa aquí |

## Consecuencias

**A favor:**
- La clasificación es una función pura de una línea de lógica, comprobable sin base de datos ni red
  (criterio 10), y su modo de fallo por desalineación con QAB es **conservador**: deja de eximir y
  se vuelve al comportamiento de hoy.
- Ningún dato del cuerpo de error de QAB sobrevive a la comparación, así que el criterio 11 se
  sostiene por la **forma** del código y no por la disciplina de quien escriba el log.
- La guarda de cabeza de línea del ADR 0011 sigue gobernando a quien ocupa la cabeza, y eso se sigue
  de una propiedad del orden por `id` que ya estaba verificada (F-006, criterios 11 y 13; el orden
  del lote es el del [ADR 0043](0043-el-orden-de-emision-se-sostiene-por-el-orden-de-insercion-en-el-outbox.md)).
- Cero constantes de política nuevas más allá de la lista de códigos y el prefijo del log. Nada que
  ajustar.

**En contra / coste asumido:**
- **No hay cota propia.** Un arrastre repetido indefinidamente es posible si QAB emite el código
  fuera de una cascada real, y este ADR no lo impide: lo hace ruidoso. Queda escrito como residuo,
  no como imposibilidad.
- Una fila arrastrada **ocupa una posición del lote de 500 en cada corrida** mientras lo esté. Hoy
  también la ocupa, pero hoy deja de ocuparla a la sexta; esa terminación por agotamiento se pierde
  para este caso, y se sustituye por la de la fila que la arrastra. Para que eso llegara a privar de
  sitio a las filas de `id` mayor harían falta ~500 arrastres sostenidos con los `id` más bajos, y
  cada uno necesita, por contrato, una fila anterior fallando en el mismo lote. **No se afirma un
  plan ni una medición sobre filas que no existen** (E-023): lo que se afirma es la relación
  estructural entre un arrastrado y la fila de `id` menor que lo arrastra.
- El log puede llegar a 500 líneas en una corrida patológica, una por arrastre. Es el mismo perfil
  que `logQabPermanentFailure`, y en el caso patológico ese ruido **es** la señal.

**Impacto en seguridad y escalabilidad:**
- **Entrada externa.** El único uso del `error` recibido es `===` contra una lista cerrada. No se
  interpola, no se trunca, no se persiste y no se registra. La cadena que llega del cable no puede
  aparecer en un log ni en el mensaje de una excepción, porque ninguna operación de este camino la
  puede romper.
- **Aislamiento multi-tenant.** Sin cambios: la disposición se decide por id, y solo sobre las filas
  que la corrida envió. Ver el ADR 0102, sección de impacto.
- **Escalabilidad.** Menos escrituras por corrida que hoy, y ninguna consulta nueva. El coste
  añadido es `O(arrastres)` en memoria y en líneas de log, acotado por `QAB_OUTBOX_BATCH_SIZE`.
- **Reversión.** Añadir una cota, o pasar a otra forma de reconocimiento, es un cambio local a
  `matchQabOutboxDeferralCode` y a `planOutboxAck`, las dos puras. No hay datos que migrar.
