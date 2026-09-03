# ADR 0023: El orden de operaciones del alta, y qué es el «registro explícito» de un token huérfano

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-003
**Se apoya en:** [ADR 0022](0022-ningun-estado-http-de-qab-se-espeja.md)

## Contexto

`POST /api/provisioning/credential` devuelve el token en claro **la única vez que se ve**
(`sync-contract.md` v10, § «Aprovisionamiento de negocios»). Es idempotente y **no rota jamás**:
repetir la llamada sobre un negocio que ya tiene token devuelve `200` con `token: null`. La propia
tabla de § «Modos de falla» del contrato tiene una fila para el desenlace malo:

> *Cuadrecaja perdió el token de un negocio que `POST /api/provisioning/credential` ya le había
> entregado (v10) → el sync de ese negocio queda parado. La única salida sigue siendo rotar con
> corte desde `npm run mint:token`, avisando antes al equipo de cuadrecaja.*

Es decir: **un `201` cuyo token no se persista es un incidente entre dos organizaciones**, con
corte de servicio para ese negocio y una llamada telefónica de por medio. No es una excepción que
se reintenta.

El criterio 6 lo traduce en un requisito verificable: *"El token acuñado se persiste ANTES de
responder al navegador: forzar un fallo después del 201 deja **registro explícito** del negocio
afectado y de que su token quedó acuñado en QAB e inaccesible… Verificado provocando el fallo."*

El spec dejó la forma de ese registro —log, tabla, ambos— como decisión de arquitectura. Y dejó
implícito algo que hay que hacer explícito: la ventana de pérdida **no es solo la escritura**. Si
la petición sale y no se puede leer la respuesta (timeout, corte de red, cuerpo ilegible), QAB pudo
haber acuñado igual, y cuadrecaja no tiene forma de saberlo. Ese caso deja el mismo negocio en el
mismo estado y hoy no lo cubre ningún criterio.

## Decisión

**Dos cosas: un orden fijo, y un registro que es una línea de log estructurada — no una tabla.**

### El orden

```
1. hasSuperAdminPrivileges()          → 403 y se acabó
2. resolveQabProvisioningSecret()     → 503 / 500  SIN NINGÚN FETCH
3. resolveQabBaseUrl()                → 503 / 500  SIN NINGÚN FETCH
4. findUnique del negocio (id del PATH) → 404
5. mintQabBusinessCredential(...)     ← la única llamada saliente
6. si 201: UPDATE del qabToken        ← lo PRIMERO tras recibirlo
7. recién ahora, construir la respuesta
```

Entre el paso 5 y el paso 6 no hay nada: ni un log, ni una validación de negocio, ni una lectura.
La escritura es lo único que separa el `201` de la respuesta al navegador, y ese es exactamente el
sentido literal del criterio 6.

El token vive en una variable local del paso 6 y **no se asigna a nada más**. El `catch` de la ruta
registra `error.name` y `error.message`, nunca el objeto de error completo ni el cuerpo de la
petición a QAB.

### El registro

**Una línea de log estructurada, con prefijo fijo, escrita con `console.error`. Sin tabla nueva.**

```
QAB_PROVISIONING_TOKEN_ORPHANED negocioId=<id> externalId=<id> reason=<REASON>
```

Tres razones, todas del mismo suceso visto desde ángulos distintos:

| `reason` | Qué pasó |
|---|---|
| `PERSIST_FAILED` | QAB devolvió `201` y el `UPDATE` de cuadrecaja falló |
| `RESPONSE_LOST` | La petición salió y no se pudo leer una respuesta utilizable (`TRANSPORT`, `INVALID_RESPONSE_BODY`, `UNEXPECTED_STATUS`) |
| `EXTERNAL_ID_MISMATCH` | La respuesta —`201` o `200`, los dos lo traen— viene con un `externalId` que no es el que se envió. No afirma que se acuñara un token: afirma que **la respuesta no se puede atribuir a este negocio**, y por tanto su estado queda sin establecer. Se registra por eso, no por lo primero |
| `CONFIRMED_ORPHANED` | QAB responde su `200` idempotente («ya tiene token») y cuadrecaja no lo tiene. Es la **confirmación**, no la sospecha |

**La propiedad que hace segura esta decisión:** la línea la construye una función pura,
`formatQabOrphanedTokenLog`, **que no recibe el token como parámetro**. No es que se acuerde de no
escribirlo: es que no lo tiene. El criterio 5 exige que el token no aparezca «en ningún log», y la
forma de garantizarlo no es revisar los logs, es que la función que los escribe no pueda conocerlo.
Eso además la hace cubrible con un test unitario, mientras `qa` provoca el fallo real.

Y el registro no se queda solo en el servidor: la ruta responde **`500 QAB_TOKEN_ORPHANED`**
(ADR 0022) con `retryable: false`. El operador que pulsó el botón se entera en la misma pantalla de
que ese negocio quedó en un estado que solo se arregla hablando con el equipo de QAB. Un log que
solo ve quien mira los logs no cumple «registro explícito del negocio afectado» para la persona que
está delante.

`retryable: false` es deliberado: **reintentar no recupera nada**. La segunda llamada devuelve
`200 token: null` y confirma la pérdida en vez de repararla.

### El reintento es el camino probable, y no puede parecer un éxito

Las tres primeras razones cubren el **primer** intento. Pero lo que hace cualquier operador ante un
error, antes de escalar, es volver a pulsar — y el paso 5 del orden dice que la llamada se hace
siempre, también si cuadrecaja cree tener token. Si QAB sí acuñó la primera vez (lo que falló fue
la comunicación o la escritura, nunca la acuñación), el reintento recibe su `200` idempotente. Sin
la cuarta razón, eso se mapearía a `ALREADY_MINTED`, con un `200` que **suena a éxito** y que la
pantalla no distinguiría del camino feliz del criterio 7. El negocio quedaría con el sync roto de
forma permanente y nadie lo sabría: el criterio 6 estaría cerrado solo para el intento menos
probable de los dos.

Por eso, cuando el resultado es `already_minted`, la ruta **relee `qabTokenConfigurado`** y, si es
`false`, devuelve un `result` propio: **`CONFIRMED_ORPHANED`**, con su línea de log. Ahí ya no hay
nada que deducir — QAB afirma que el token existe de su lado y cuadrecaja afirma que no lo tiene.

La detección vive **en la ruta**, no en la pantalla: hacer que la UI cruce `result` con
`settings.qabTokenConfigurado` deja la propiedad de seguridad a merced de que un componente
combine bien dos campos.

Sale con **`200`**, no con un `5xx`: la ruta funcionó y QAB respondió: lo que se comunica es un
**estado conocido**, no un fallo de ejecución. El precio —un `200` que para la monitorización
parece un éxito— se paga con la línea de log, que es el observable, y con que la pantalla lo trate
como alerta y **no ofrezca reintentar**: un tercer intento devuelve lo mismo, porque esa ruta no
rota jamás. La salida es una rotación con corte desde QAB.

### Por qué el huérfano NO se persiste en una columna

Levantado por el `ui-designer`, que llegó a este mismo estado por su cuenta: la línea de log no
sobrevive a una recarga, así que tras un F5 un negocio con el token huérfano se ve **igual que uno
al que nunca se dio de alta**. La opción evidente es una columna aditiva y nullable en `Negocio`
—`qabTokenHuerfanoAt`— que se escriba al detectarlo y se limpie al guardar por fin un token.

**Se consideró y se descarta**, por un motivo concreto y no por ahorrar trabajo: **en el caso que
esa columna existe para cubrir, la escritura es justo la que no se puede dar por hecha.** Las tres
razones se comportan distinto frente a la base de datos:

| Razón | ¿Se podría escribir la marca? | ¿Aporta algo? |
|---|---|---|
| `PERSIST_FAILED` | **No de forma fiable.** Es literalmente el caso en que el `UPDATE` de esa misma fila acaba de fallar: base caída, fila bloqueada, pool agotado. Un segundo `UPDATE` a la misma fila falla por la misma causa | Es el único caso donde haría falta —nadie ha pulsado todavía— y es donde menos se puede confiar |
| `RESPONSE_LOST` | Sí, la base está sana | Marcaría una **sospecha** como si fuera un hecho: la petición pudo no haber llegado nunca a QAB. Falsos positivos que después hay que limpiar a mano |
| `CONFIRMED_ORPHANED` | Sí | Solo ocurre **después** de que alguien pulse — y en ese momento ya está viendo la alerta en pantalla |

Es el mismo razonamiento que descartó la tabla al principio de este ADR, un escalón más abajo: un
registro que se cae por la misma causa que el suceso que registra no es un registro.

**Lo que sí se hace, y cuesta cero:** la pantalla marca como anómalo el estado
`tiendaOnlineHabilitada && !qabTokenConfigurado` —«habilitado y sin credencial»— derivándolo de los
dos campos que el bloque QAB ya expone. Cubre exactamente el daño real: un token huérfano solo
hace daño cuando el interruptor está encendido, porque es entonces cuando el negocio debería estar
sincronizando y el cron lo salta en silencio. Con el interruptor apagado el estado es inocuo, y se
vuelve visible en el instante en que alguien lo enciende. No distingue «huérfano» de «nunca dado de
alta» — y no hace falta: **la primera acción es la misma para los dos**, y la respuesta dice cuál
era. Un estado derivado, además, no puede quedarse viejo; una marca persistida sí, y de las dos
formas: si QAB limpia la fila por SQL —la única limpieza que su contrato admite—, la columna
seguiría gritando para siempre.

**Cuándo se reabre**, explícitamente: si el desenlace llega a ocurrir más de una vez, o si hace
falta **listar** los negocios afectados a nivel de plataforma sin recorrerlos uno a uno. Entonces la
columna se añade escribiéndola solo en `RESPONSE_LOST` y `CONFIRMED_ORPHANED`, que son los caminos
donde consta que la base responde, y `PERSIST_FAILED` se sigue apoyando en el log.

### Concurrencia: un falso positivo acotado y asumido

La detección de `CONFIRMED_ORPHANED` introduce una carrera que hay que nombrar. Dos altas
simultáneas del mismo negocio sin token: A recibe el `201` y escribe; B recibe el `200` idempotente
y, si su relectura cae **antes** del `UPDATE` de A, ve `qabTokenConfigurado: false` y diagnostica un
huérfano que no existe.

Se mitiga sin serializar, con dos medidas gratuitas:

- **Las dos lecturas tienen que concordar**: la del paso 4 y la relectura final. Si discrepan, otra
  petición escribió el token entremedias y el resultado es `ALREADY_MINTED`.
- **La pantalla deshabilita la acción mientras la petición está en vuelo**, que elimina el caso
  realista —el doble clic— y no solo lo hace improbable.

Queda un residuo: dos superadministradores dando de alta el mismo negocio en la misma ventana de
una ida y vuelta HTTP. **Se asume.** El fallo es una **falsa alarma**, no pérdida de datos, y se
corrige sola en la siguiente pulsación, que devolverá `ALREADY_MINTED`.

**No se serializa con un bloqueo de advertencia** aunque el repositorio ya tenga el patrón
(`withQabOrderPollLock`, ADR 0009): ese bloqueo mantiene una transacción abierta mientras corre el
trabajo, y aquí el trabajo es una llamada HTTP a otra organización de hasta 15 s. Hacer eso en una
ruta que responde a una persona significa retener una conexión del pool dedicado del ADR 0015 —dos
por defecto, dimensionadas para el cron— durante todo ese tiempo. Sería cambiar un error cosmético
y raro por un riesgo real de disponibilidad sobre la sincronización de todos los negocios. La
proporción manda.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Una tabla `QabProvisioningIncidente` | Es la opción más durable y la que un día puede hacer falta, pero hoy cuesta una migración coordinada que el alcance de F-003 excluye explícitamente, y añade una escritura a base de datos **en el camino donde el fallo que se registra es, en el caso principal, que la base de datos falló**. Un registro que se cae por la misma causa que el suceso no es un registro |
| Tabla **y** log | El coste de la migración sin la ventaja: mientras el log exista, la tabla no añade nada que no se pueda reconstruir |
| Solo el log, sin código propio en la respuesta | El criterio pide registro «del negocio afectado»; quien tiene que actuar es la persona que pulsó el botón, y no está leyendo los logs de Vercel |
| Escribir primero un `qabTokenActualizadoAt` de intención y el token después | Dos escrituras donde hay que minimizar la ventana. Y deja un estado intermedio —fecha sin token— que ninguna lectura sabría interpretar |
| Reintentar el `UPDATE` con backoff | Cabe, pero no cambia la decisión: si el reintento también falla hay que registrar igual. Se deja fuera para que el camino sea uno solo y auditable; añadirlo después no reabre este ADR |
| Reintentar la llamada a QAB tras un fallo de transporte | No recupera un token perdido: la ruta es idempotente y devolvería `200 token: null`. Sí es útil como acción **manual** del operador, y por eso `TRANSPORT` viaja con `retryable: true` — pero acompañado del registro, porque puede haber acuñado ya |
| Dejar que `CONFIRMED_ORPHANED` salga como `ALREADY_MINTED` y que la pantalla lo distinga cruzando `qabTokenConfigurado` | Es el estado más probable tras un fallo, no un borde, y quedaría indistinguible del camino feliz del criterio 7. Además deja una propiedad de seguridad dependiendo de que un componente combine bien dos campos |
| Devolver `CONFIRMED_ORPHANED` como `500` | La ruta no falló y QAB respondió: el `500` diría que cuadrecaja se rompió, cuando lo que hay es un estado conocido y comunicado correctamente. El registro y la alerta de pantalla son lo que impide que el `200` se lea como un éxito |
| Una columna `Negocio.qabTokenHuerfanoAt` que persista el estado | En `PERSIST_FAILED` —el único caso donde nadie ha pulsado todavía y por tanto el único donde haría falta— la marca es un `UPDATE` sobre la misma fila cuyo `UPDATE` acaba de fallar. Y añade la primera migración a un feature que no tiene ninguna. Ver § «Por qué el huérfano NO se persiste» |
| Serializar el alta con un bloqueo de advertencia por negocio | Mantendría una transacción abierta durante una llamada HTTP de hasta 15 s a otra organización, reteniendo una conexión del pool dedicado del ADR 0015. Cambia una falsa alarma rara por un riesgo de disponibilidad sobre el cron de todos los negocios |
| Poner una cuota de frecuencia a la acción | Necesita estado compartido que hoy no existe. El bucle real —el doble clic y el reintento de `axiosClient`— ya está cerrado, y quien pulsa es un `SUPER_ADMIN` |
| Guardar el token en otro sitio «por si acaso» antes de escribirlo | Duplicar un secreto para protegerse de perderlo es exactamente el patrón que este feature existe para eliminar |

## Consecuencias

**A favor:**
- El criterio 6 se verifica provocando el fallo y buscando el prefijo en la salida del servidor;
  el criterio 5 se verifica buscando el token en esa misma salida y no puede estar, porque la
  función que la escribe no lo recibe.
- La ventana de pérdida queda **nombrada y acotada**: es exactamente la distancia entre el paso 5
  y el paso 6.
- Se cubren además las dos ventanas que ningún criterio nombraba —la respuesta perdida y, sobre
  todo, **el reintento que confirma la pérdida**— con el mismo mecanismo.
- El criterio 6 deja de estar cerrado solo para el primer intento: el camino que de verdad va a
  recorrer un operador queda cubierto y es visible en pantalla.
- Coste cero de migración; reversible borrando un archivo.

**En contra / coste asumido:**
- Un log se puede rotar y perder. Si el desenlace se repitiera —cosa que no ha pasado nunca, porque
  la ruta aún no se ha usado— la tabla es el siguiente paso, y este ADR queda como el contexto de
  por qué no se hizo ya.
- **El estado del huérfano no sobrevive a una recarga.** Se descubre pulsando «Comprobar el alta en
  QAB», o se intuye por la anomalía derivada «habilitado y sin credencial». La plataforma no puede
  hoy **listar** los negocios afectados; el día que haga falta, eso es lo que reabre la columna.
- Queda un falso positivo posible bajo concurrencia real de dos superadministradores. Es una falsa
  alarma que se corrige en la pulsación siguiente.
- No hay alerta automática: alguien tiene que mirar. Mitigado porque el operador ve el error en
  pantalla en el mismo instante.
- `RESPONSE_LOST` puede registrar un huérfano que no lo es (la petición no llegó a QAB). Es un
  falso positivo barato: la comprobación es volver a pulsar y mirar si responde `ALREADY_MINTED`.

**Impacto en seguridad y escalabilidad:**
- **El token no puede aparecer en el registro**: no es un parámetro de la función que lo formatea.
- El log contiene dos identificadores y un código de un enum cerrado. `negocioId` y `externalId`
  son el mismo valor por diseño, y se escriben los dos a propósito: si algún día dejaran de
  coincidir, la línea es la única prueba de cuál se envió.
- **Aislamiento:** el `externalId` que se registra es el que se envió, leído del path, nunca uno
  del cuerpo de la respuesta.
- Sin coste de escritura en base de datos en el camino de fallo, que es justo donde no se puede
  depender de ella.
