# Solicitudes abiertas al equipo de queandabuscando

Cosas que el contrato exige o presupone y que su API no ofrece hoy. Cada una bloquea features
concretos de [`features.json`](features.json). Se registran aquí para que no se pierdan entre
conversaciones y para que el bloqueo tenga una causa nombrada.

Al resolverse: anotar la versión del contrato que la incorpora, desbloquear los features
afectados y borrar la entrada de la tabla de abiertas.

## Abiertas

| # | Qué falta | Bloquea | Desde |
|---|-----------|---------|-------|
| S-002 | Qué hace el SQL espejo con un producto borrado en blando | F-008 | contrato v7 · 2026-09-01 |
| S-004 | `EXCHANGE_RATE` no invalida la caché del catálogo público | nada; degrada F-006 | contrato v10.1 · 2026-09-06 |
| S-005 | `EXCHANGE_RATE` no tiene guarda anti-rancio: una tasa vieja reintentada se vuelve la vigente | nada; degrada F-006 | contrato v10.1 · 2026-09-06 |
| S-006 | Un fallo por evento no arrastra a los que dependían de él en el mismo lote | nada; degrada F-006 | contrato v10.1 · 2026-09-06 |
| S-007 | **v11** · Envío por zonas: `ZONE_BASED`, tarifario por zona y `contact.zoneCode` | F-013, F-016 | contrato v10.1 · 2026-09-06 |
| S-008 | **v11** · El escaparate no sabe qué monedas mostrar (`displayCurrencies`) | — (feature por definir) | contrato v10.1 · 2026-09-06 |

## Resueltas

| # | Qué faltaba | Resuelta en | Cuándo |
|---|-------------|-------------|--------|
| S-001 | Releer un pedido concreto sin depender del cursor | contrato v8 (F-033 de QAB) | 2026-09-03 |
| S-003 | El claim `email` del SSO exige forma de correo y el contrato no lo dice | **en cuadrecaja: F-023**. No se pidió nada a QAB | 2026-09-06 |

---

### S-001 · No hay forma de releer un pedido concreto — RESUELTA en la v8

> **Cerrada el 2026-09-03.** La v8 del contrato (F-033 de QAB) concede **las dos** formas que se
> pidieron abajo, no una. Ver § ③④ Pedidos, «Las lecturas laterales». F-013 y F-017 pasan de
> `blocked` a `pending`; F-015 sigue bloqueado, pero por su otro motivo —el lado receptor de la
> v6— y no por esto. El apaño de `?since=<id-1>&limit=1` se descarta: nunca se construyó.
>
> Lo que quedó, y ata al implementar:
>
> - `GET /api/internal/orders?status=<UN estado>` — un solo estado, la coma es `400`. Es la
>   relectura del ciclo normal, y el contrato la nombra literalmente para los `AWAITING_CUSTOMER`.
> - `GET /api/internal/orders?ids=<a>,<b>` — hasta **100** ids; por encima es `400
>   IDS_LIMIT_EXCEEDED`, nunca la lista recortada en silencio. Un id de otro negocio responde igual
>   que uno inexistente: `200 { "orders": [] }`.
> - `?after=` pagina **solo** `?status=`, sobre su propio puntero `nextAfter`. Sin `?status=` es
>   `400`.
> - `nextCursor` es **siempre `null`** en las dos, y **ninguna lateral mueve el cursor del pull**:
>   repetir el pull con el mismo `since` devuelve el mismo cuerpo. `nextAfter` no viaja nunca en el
>   pull incremental.
> - Una lateral **no marca `PULLED`**, así que **no cuenta** para «un solo pull en vuelo por
>   negocio» y puede lanzarse en paralelo. Sí aplica los dos vencimientos antes de leer.
> - Dos laterales simultáneas pueden ver **estados distintos del mismo pedido** si su vencimiento
>   cae entre las dos. No es un bug que reportar: gana la más reciente.
> - `400 INVALID_QUERY` entra por fin en el vocabulario de errores; la ruta lo emitía desde F-007
>   sin que el contrato lo recogiera.

**El problema, tal como se planteó.** El único endpoint de lectura de pedidos era
`GET /api/internal/orders?since=&limit=`, que filtra `id > since`. Pero la resolución de una
propuesta ocurre siempre sobre un pedido que el POS **ya pulleó**, cuyo `id` es por tanto **menor
que el cursor**. El pull incremental nunca lo devolvía.

Consecuencia directa: **el encargado no se enteraba nunca de que el comprador aceptó o rechazó.**
No era un caso raro — con el envío cotizado de la v6, cotizar *es* proponer, así que el camino
pasa por ahí en cada pedido a domicilio de una tienda en `QUOTED_PER_ORDER`.

**Lo que se pidió.** Cualquiera de las dos, `?ids=` o `?status=`, con preferencia por la segunda
porque el POS no tiene por qué llevar la lista. Llegaron las dos, y con `nextCursor` sin moverse,
que era la condición que se puso.

---

### S-002 · El SQL espejo no dice qué hacer con un borrado en blando

**El problema.** El SQL espejo de reconciliación que publica el contrato (§ ⑤) selecciona de
`ProductoTienda` filtrando por tienda, por `publicarEnTienda`, por `precio` no nulo y por
`monedaPrecioCode` no nulo. No filtra nada más, porque no puede: el schema de cuadrecaja es de
cuadrecaja y vosotros no lo conocéis.

Pero cuadrecaja **no borra productos, los marca**: `Producto` y `ProductoTienda` tienen `deletedAt`
y el borrado es blando. Una fila borrada de esa forma sigue existiendo, sigue teniendo precio y
moneda, y sigue colgando de un producto con `publicarEnTienda = true` — así que **el espejo la
cuenta**. Del vuestro, en cambio, ese producto ya no está: lo despublicamos y os llegó su baja.

Consecuencia: el hash diverge y **no vuelve a converger nunca**. Y esa divergencia es exactamente
la señal con la que F-008 concluye que la sincronización se rompió, así que dispara la
recuperación (poner `dispPublicada = NULL` en todas las filas de la tienda) y la alerta, una y
otra vez, sobre unos datos que en realidad están bien.

**Lo que preguntamos.** No es una petición de API: es una aclaración del contrato, y creemos que
la respuesta correcta es la primera.

- ¿Confirmáis que el espejo debe excluir las filas dadas de baja, y que la exclusión es
  responsabilidad del lado que la tiene (nosotros añadimos `AND p."deletedAt" IS NULL AND
  pt."deletedAt" IS NULL`)? Si es así, nos vale con que quede escrito en el § ⑤ como nota, para
  que el siguiente que lo lea no tenga que deducirlo.
- ¿O hay algún caso en el que un producto retirado deba seguir contando por vuestro lado?

**Por qué no lo decidimos solos.** Podríamos añadir el filtro y seguir. Pero el hash es un acuerdo
entre dos bases de datos de dos organizaciones: si cada lado ajusta el espejo por su cuenta para
que le cuadre, deja de detectar lo que existe para detectar. Preferimos que la regla esté escrita
en el documento vinculante.

**Mientras tanto** no bloquea nada inmediato. F-001 solo comprueba que el SQL corre contra el
schema real, y ahí el soft delete no interviene. Quien tiene que estar resuelto antes es **F-008**,
que es donde el hash pasa a ser una decisión operativa.


---

### S-003 · El claim `email` del SSO se valida como correo — CERRADA en cuadrecaja, sin pedir nada

> **Cerrada el 2026-09-06, y en la dirección contraria a la que proponía esta solicitud.** Decisión
> del humano: **QAB se queda como está**. No se le pide que relaje `z.email()`, no se le pide que
> documente el requisito, y no se toca `qabSsoClaimsSchema` de este lado (sigue con
> `z.string().min(1)`, ADR 0067 intacto).
>
> Lo que se hizo es detectar el caso **antes de firmar** y explicárselo al comerciante en nuestra
> propia pantalla: F-023, verificado por `qa` ejecutando, incluido un canje real contra una
> instancia de queandabuscando. `POST /api/tienda-online/sso` responde `409
> TIENDA_ONLINE_SSO_USER_NOT_EMAIL` y no emite ningún JWT.
>
> **Un dato de esta solicitud resultó ser falso y conviene no arrastrarlo:** decía que
> `EMAIL_REGEX` se aplica solo en el alta y que no hay validación en la API. Verificado: el patrón
> estaba duplicado literal en **siete** sitios, tres de ellos route handlers de backend, y dos bajo
> el nombre `EMAIL_PATTERN`. Ninguno corría en el camino del SSO — que es el hueco real. F-023 los
> unificó en `src/constants/validation.ts` (ADR 0087).
>
> Lo de abajo se conserva como quedó escrito el 2026-09-05.

**Cómo apareció.** Verificando F-009 de punta a punta contra una instancia de desarrollo de
queandabuscando. No lo encontró una lectura del contrato: lo encontró un canje real que falló.

**El problema.** El ADR 0067 de cuadrecaja decidió emitir el claim `email` desde `Usuario.usuario`
—que es el campo de identidad de cuadrecaja, único y validado con `EMAIL_REGEX` **en el alta**—
apoyándose en que el contrato **no publica ningún requisito de formato** para ese claim. Y no lo
publica: ni `sync-contract.md`, ni `despliegue.md` § 8.4, ni el bloque «Fase 1 · B» de
`flujos-cc-qab.html` dicen nada del formato.

Pero el código receptor sí lo exige. En `src/lib/auth/ssoToken.ts` de queandabuscando, el claim se
valida con `z.email().optional()`. Un token cuyo `email` no tenga forma de correo se rechaza con:

```
401 {"error":"SSO_REJECTED","reason":"malformed"}
```

**Por qué importa, y por qué no lo detecta cuadrecaja.** `EMAIL_REGEX` se aplica al **alta** de un
usuario. Las cuentas creadas **antes** de esa validación conservan un `usuario` que puede ser
`admin`, `vendedor` o cualquier cosa. Esos usuarios verán el botón, recibirán un enlace bien
firmado, y el canje fallará **del lado de queandabuscando**, sin que nada del lado de cuadrecaja
haya ido mal. El fallo aparece en producción, en la cara del comerciante, y el log útil está en la
otra organización.

**Lo que preguntamos.** No es una petición de API: es una discrepancia entre el documento y el
código, y hay dos salidas legítimas. Preferimos que lo decidáis vosotros, porque el que valida sois
vosotros.

- ¿Confirmáis que el formato de correo **es** un requisito del claim? Si es así, basta con que quede
  escrito en `despliegue.md` § 8.4, y el arreglo es nuestro: cuadrecaja tendrá que decidir qué
  emite para una cuenta cuyo `usuario` no es un correo.
- ¿O el `z.email()` es más estricto de lo que pretendíais, y el claim debería aceptar cualquier
  cadena no vacía —siendo `sub` la identidad real y `email` solo un dato de presentación?

**Qué NO bloquea.** F-009 está cerrado y verificado: cuadrecaja emite `Usuario.usuario` verbatim,
que es exactamente lo que su ADR 0067 decidió, y todos sus criterios de aceptación pasan. Esto es un
riesgo de despliegue, no un feature detenido. **Conviene resolverlo antes de que el SSO llegue a
producción**, no antes de seguir programando.

---

### S-004 · `EXCHANGE_RATE` no invalida la caché del catálogo público

**Cómo apareció.** Repasando el comportamiento de un negocio con varias monedas habilitadas cuyas
tasas se mueven a diario, que en Cuba es el caso normal y no el raro.

**El problema.** Lo dice el propio contrato, § «`payload` de `EXCHANGE_RATE`»:

> «**Ni `CURRENCY` ni `EXCHANGE_RATE` invalidan ninguna caché.** Una tasa nueva puede tardar hasta
> una hora en verse en el catálogo público —el suelo de revalidación de la vitrina, 3600 s—. El
> checkout, en cambio, las lee frescas en cada pedido: **un pedido nunca se cotiza con una tasa
> caducada**, aunque la vitrina todavía muestre la anterior.»

La garantía del checkout es la correcta y no la discutimos. Lo que pedimos es cerrar la ventana de
la vitrina, porque con tasas volátiles no es un detalle cosmético:

Un negocio con `monedaBase = CUP` publica un producto a `price: 25, currency: "USD"`. A las 09:00
la tasa pasa de 440 a 480 y a las 09:02 el evento ya está aplicado. Durante hasta 58 minutos la
vitrina enseña ≈11 000 CUP y el checkout cobra 12 000. El comprador ve un precio, paga otro, y en
el mejor de los casos se lleva un `409 PRICE_CHANGED` que no sabe interpretar. Es una queja
garantizada y la explicación —«es la caché»— no es defendible de cara al comerciante.

**Lo que pedimos.** Que aplicar un evento `EXCHANGE_RATE` (y un `CURRENCY`) revalide las páginas
cacheadas del negocio afectado que muestran importes derivados de una tasa. Con dos condiciones que
conviene dejar escritas, porque sin ellas el remedio es peor:

- **Coalescido por lote y por negocio.** Aplicar las tasas de referencia de elTOQUE es una acción de
  un clic que registra 3 o 4 monedas seguidas: llegan en el mismo drenaje y no pueden disparar 3 o 4
  invalidaciones. Una por negocio y por lote.
- **Alcance por negocio, no global.** Invalidar la vitrina entera porque un comercio movió su tasa
  del euro es un efecto desproporcionado sobre negocios que no tienen nada que ver.

**Interacción con S-008.** Si el escaparate multi-moneda se resuelve convirtiendo **en el cliente**
contra un endpoint de tasas de TTL corto, el HTML cacheado sigue siendo correcto —el precio canónico
se pinta en su propia moneda y no depende de ninguna tasa— y esta solicitud deja de estar en el
camino crítico: haría falta solo donde quede algún importe convertido renderizado en servidor.
Merece la pena decidir las dos a la vez.

**Qué NO bloquea.** Nada. F-006 está cerrado y verificado; cuadrecaja emite el evento correctamente
y a los 2 minutos está aplicado. Esto es degradación de la experiencia del comprador, del lado de
queandabuscando, no un feature detenido aquí.

---

### S-005 · `EXCHANGE_RATE` no tiene guarda anti-rancio: una tasa vieja reintentada se vuelve la vigente

**Cómo apareció.** Recorriendo qué pasa cuando un evento de tasa falla por fila y se reintenta,
cruzando el § «`payload` de `EXCHANGE_RATE`» con nuestro [ADR 0011](../docs/adr/0011-reintentos-del-outbox-sin-backoff.md)
(reintentos sin backoff, corte en 6).

**El problema.** El contrato lo declara como asimetría deliberada, y por eso lo traemos como
pregunta y no como bug. § «Cambios respecto a la v10», asimetrías 3 y 4:

> «**`EXCHANGE_RATE` es append-only**, y la tasa vigente es la última que **llegó**, no la de
> `updatedAt` más reciente. Corregir una tasa es enviar otra.»
>
> «`updatedAt` solo es guarda anti-rancio en `STORE`, `PRODUCT` y `CATEGORY`; en `CURRENCY` y
> `EXCHANGE_RATE` se valida el formato y **no se compara con nada**.»

Y § «`payload` de `EXCHANGE_RATE`» lo dice sin rodeos: «Un reenvío desordenado de una tasa vieja la
convierte en la vigente.»

Ese reenvío desordenado no es hipotético con nuestro outbox. La secuencia completa:

1. 10:00 — se registra USD 440 → evento **#101**.
2. 10:02 — el drenaje lo envía y vuelve en `failed[]`. Queda con `procesadoAt` null e `intentos: 1`.
   No hay backoff: se reintentará en la corrida siguiente.
3. 10:04 — el comercio corrige a USD 480 → evento **#102**.
4. 10:04 — si los dos entran en el mismo lote llegan en orden de `id` y gana 480. **Correcto.**
5. Pero si #101 vuelve a fallar y #102 pasa, la vigente queda en 480 — y en la corrida siguiente
   #101 se reintenta, **pasa**, y **440 vuelve a ser la vigente**.

La tienda cotiza por debajo de su precio hasta que alguien registre otra tasa. No hay error, no hay
alerta y ninguno de los dos lados lo detecta. Con `orderExpiryHours` y pedidos vivos por medio, son
pedidos reales cobrados a una tasa que el comercio ya había corregido.

**Lo que pedimos.** No es «rechazar la tasa vieja»: es **que «vigente» deje de ser una función del
orden de llegada y pase a serlo de `updatedAt`**, por `(businessId, currency)`.

Así el append-only se mantiene intacto —la fila se inserta igual, el histórico queda completo, no
hay nada que borrar— y el desorden se vuelve inofensivo sin que nadie tenga que garantizar un orden
de entrega. Es además el mismo criterio que ya aplicáis en las otras tres entidades: no es un
concepto nuevo del contrato, es extender uno que ya está escrito.

Si preferís la variante de rechazo (no insertar cuando `updatedAt` es anterior al de la vigente),
nos vale igual, pero entonces necesitamos que quede escrito:

- Con qué vocabulario responde. Hay precedente: en `PRODUCT` y `CATEGORY` un evento rancio responde
  `stale`, va en `ok` y no se reintenta. Reutilizarlo evitaría que nuestro outbox lo cuente como
  fallo y gaste sus 6 intentos.
- Si el empate (`updatedAt` idéntico) se resuelve como rancio o como aplicable. Por nuestro lado no
  hay riesgo real —cada tasa sale de una petición HTTP distinta con su propio instante— pero conviene
  que esté dicho.
- Que el histórico queda con un hueco, y que lo dais por bueno.

**Qué hacemos mientras tanto, por nuestro lado.** Al encolar una tasa nueva de `(negocio, moneda)`,
cancelar los `EXCHANGE_RATE` **pendientes** de esa misma clave: un evento que nunca salió no tiene
por qué salir si ya hay uno más nuevo detrás. Cubre el caso 5 de arriba en su forma más común, pero
**no** cubre un evento ya en vuelo, ni uno que aplicasteis y nos reportasteis como fallido. Para eso
hace falta la guarda de vuestro lado. Las dos son defensa en profundidad, no alternativas.

**Qué NO bloquea.** Nada. Es una degradación silenciosa que preferimos no tener en producción antes
de que haya muchos negocios multi-moneda.

---

### S-006 · Un fallo por evento no arrastra a los que dependían de él en el mismo lote

**Cómo apareció.** Es el caso residual que nuestro
[ADR 0043](../docs/adr/0043-el-orden-de-emision-se-sostiene-por-el-orden-de-insercion-en-el-outbox.md)
dejó escrito a propósito en vez de esconder, al implementar F-006.

**El problema.** El orden de **envío** ya está resuelto y no os pedimos nada sobre él: la cadena
`ORDER BY id` → agrupar por negocio → construir el lote conserva el orden de inserción, así que
`CURRENCY` sale antes que su primera `EXCHANGE_RATE` y `CATEGORY` antes que los `PRODUCT` que la
referencian, dentro del lote y entre lotes.

Lo que no cubre ningún orden es la **aplicación parcial**:

> `CATEGORY` y `PRODUCT` viajan en el mismo lote, queandabuscando devuelve el `CATEGORY` en
> `failed[]` y el `PRODUCT` en `ok`. El producto queda con `localCategoryId: NULL`.

Y a partir de ahí el contrato es explícito en que nadie lo repara:

> «Un `PRODUCT` cuyo `localCategoryId` apunta a una categoría que todavía no llegó **no falla**: se
> guarda sin categoría, con `localCategoryId` a `NULL`, y se queda así hasta el siguiente evento de
> ese producto — **el evento de la categoría, cuando llegue, no va a buscar quién la esperaba**.»

El comerciante ve su producto publicado y sin categoría, y nada del sistema le dice por qué. La
variante con monedas es peor de leer: la moneda se crea al vuelo con `name` y `symbol` iguales al
código, y queda un `USD / USD` provisional en una tabla **global a la plataforma**.

**Lo que pedimos.** Que un fallo por evento arrastre, **dentro del mismo lote**, a los eventos
posteriores que dependen de él: en vez de aplicarse con la referencia a `NULL` o con una fila
provisional, van también a `failed[]` y se reintentan enteros.

Las dependencias son las dos que el propio contrato ya nombra, no hace falta inventar un concepto
nuevo:

- `CATEGORY` → los `PRODUCT` posteriores del lote cuyo `localCategoryId` es el de esa categoría.
- `CURRENCY` → la `EXCHANGE_RATE` y los `PRODUCT` posteriores del lote con ese `code` / `currency`.

**Por qué lo preferimos de vuestro lado.** Podemos construir —y probablemente construyamos— una red
de seguridad aquí: al ver una dependencia en `failed[]`, reencolar sus dependientes de ese lote. Pero
eso es una reparación *a posteriori*: el producto ya estuvo publicado y visible sin su categoría
durante al menos una corrida más. Con el fallo en cascada no llega a aplicarse mal ni una vez.

Y hay una trampa que nos afecta a nosotros y conviene dejar anotada por si os sirve: un evento
reencolado necesita un `updatedAt` **nuevo**, porque si conserva el original la guarda anti-rancio de
`PRODUCT` lo responde `stale` y la reparación no repara nada.

**Qué NO bloquea.** Nada. F-006 está cerrado y sus criterios 11 y 13 verifican el orden de emisión,
que es lo que sí depende de nosotros.

---

### S-007 · v11 · Envío por zonas: `ZONE_BASED`, tarifario por zona y `contact.zoneCode`

> Decisión del humano el 2026-09-06: **se abre la conversación de la v11.** F-013 y F-016 quedan
> `blocked` mientras tanto — ver la nota de secuenciación al final.

**Cómo apareció.** Necesidad de producto, no un hueco del contrato: los comercios cubanos cobran el
envío por municipio, y hoy el contrato solo permite una tarifa plana única por sucursal o cotizar a
mano pedido a pedido.

**El problema.** El modelo actual es binario y el contrato lo justifica así:

> «Hay negocios que solo saben cuánto cuesta el envío **cuando alguien mira el pedido**: depende de
> la dirección, del mensajero libre y de la hora. Hasta la v5.1, la tienda de ese negocio tenía que
> inventarse una tarifa fija o no ofrecer domicilio.»

Es decir: la variabilidad por dirección se resuelve **con una persona**. Para un comercio que ya
sabe su tarifario —«Playa 300, Habana Vieja 250, Boyeros 500»— eso convierte cada pedido a domicilio
en un ciclo de propuesta y aprobación que ni el comercio ni el comprador necesitan. Con
`QUOTED_PER_ORDER` el comprador confirma **sin ver el costo del envío** y el total llega parcial; con
`FLAT_RATE` paga lo mismo desde el municipio de al lado que desde el otro extremo de la provincia.

Lo que falta para cerrarlo es que el precio del envío pueda depender de **dónde** entrega, y eso hoy
no tiene ninguna forma de existir: `contact` tiene exactamente cuatro claves —`name`, `phone`,
`email`, `address`— y `address` es texto libre. No hay ningún dato de la dirección del comprador que
sea computable.

**Lo que pedimos.** Cuatro piezas. Las tres primeras son el contrato; la cuarta es un acuerdo de
datos que **no viaja por el sync**.

1. **`deliveryFeeMode: "ZONE_BASED"`** como tercer valor del enum. Sabemos que vuestro ADR 0028 dice
   que «un modo de envío o de checkout nuevo es una versión nueva del contrato, no un literal más en
   una lista» — por eso esto es una v11 y no una pregunta suelta.
2. **Un tarifario por zona y sucursal, escrito por cuadrecaja.** `(storeId, zoneCode) → deliveryFee`.
   Proponemos que sea una **sexta entidad del outbox** (`ZONE_TARIFF`) y **no** un array anidado en
   el `payload` de `STORE`: con ~168 municipios, una tienda que sirva media provincia no cabe en un
   payload cuyo precedente de tamaño (`openingHours`) son 2 KB, y un cambio de una tarifa no debería
   reenviar la configuración completa del local.
3. **`contact.zoneCode`** en el pedido del pull, más `contact.lat` / `contact.lng` **opcionales**. El
   `zoneCode` es lo que decide el precio; el par de coordenadas es para el mensajero y para calcular
   distancias, y nunca para cobrar.
4. **Un catálogo geográfico compartido, versionado, identificado por un `code` estable** (el código
   DPA/ONEI de provincia y municipio, con un segundo nivel opcional por debajo). Cada lado tiene su
   copia, sembrada de la misma fuente. **Los polígonos no viajan por el sync**: por el cable va el
   `code` y nada más.

**Lo que hay que decidir juntos, y por eso lo traemos como conversación y no como especificación:**

- **Zona sin tarifa.** Si el comprador elige un municipio para el que esa tienda no tiene tarifa,
  ¿es «no entregamos ahí» y el checkout no ofrece domicilio, o cae a `QUOTED_PER_ORDER`? Nuestra
  propuesta: lo primero, y que la tienda declare explícitamente las zonas que sirve. Un envío que se
  ofrece y luego hay que cotizar es la peor de las dos experiencias.
- **Convivencia de modos.** ¿`ZONE_BASED` puede caer a cotización manual para un pedido concreto, o
  son excluyentes? Nos vale cualquiera de las dos, pero cambia la UI de los dos lados.
- **Versión del catálogo.** Cómo sabe cada lado que comparte la misma versión, y qué pasa con un
  `zoneCode` que uno conoce y el otro no.
- **Quién siembra el catálogo y desde dónde.** Nuestra propuesta es OpenStreetMap (`admin_level` 4 y
  6), exportado una vez a GeoJSON simplificado. No proponemos Google Maps: la cobertura de Cuba es
  pobre y su API arrastra restricciones de embargo.

**Lo que NO pedimos, porque ya existe.** `Store.latitude` y `Store.longitude` ya viajan en el
`payload` de `STORE` y cuadrecaja ya los guarda y los emite (`Tienda.latitud` / `Tienda.longitud`).
Vuestro ADR 0011 dice que los capturáis «para el día que se implemente la búsqueda por cercanía»:
ese día es este, y el dato ya está.

**Sobre la precisión, que es lo que da forma al diseño.** No proponemos geocodificar ni confiar en el
GPS: en Cuba el callejero es fino y no hay números de casa, así que un pin es una fuente de verdad
falsa. La zona la **elige la persona** —tocando su municipio sobre un mapa, con una lista como
alternativa— y el GPS, si acaso, sugiere. Eso es lo que hace que `zoneCode` sea un dato fiable y las
coordenadas un extra.

**Qué bloquea.** F-013 y F-016, que quedan congelados a propósito: F-016 fija el enum de
`deliveryFeeMode` en dos valores y F-013 iba a construir un tarifario de zonas **local, con nombre
libre**. Cerrar cualquiera de los dos antes de esta conversación obliga a reabrirlo.

---

### S-008 · v11 · El escaparate no sabe qué monedas mostrar (`displayCurrencies`)

> Decisión del humano el 2026-09-06: se pide junto con S-007, en la misma v11.

**Cómo apareció.** Necesidad de producto: un negocio que tiene varias monedas habilitadas quiere que
el comprador vea el precio **en todas ellas**, igual que ya lo ve el vendedor en el POS de
cuadrecaja.

**El problema.** Del lado de queandabuscando están los datos —la tabla global de monedas y las tasas
por negocio— pero falta la señal de **qué subconjunto mostrar**, y hoy el escaparate no las usa:

> «Hoy ninguna página pública lee esta tabla: los importes se muestran con el código (`CUP`, `USD`),
> no con `symbol`. […] Enviar `CURRENCY` no cambia nada visible por sí solo.»

Esa señal existe en cuadrecaja y se llama `NegocioMoneda`, con su bandera `activo`. **No viaja
nada de eso**: `CURRENCY` es la única entidad sin `businessId` y su tabla es global, así que no hay
ningún sitio en el contrato donde quepa «este negocio muestra estas monedas».

**Por qué no vale derivarlo.** La derivación tentadora es «las monedas con `ExchangeRate` de este
negocio, más su `baseCurrency`». No sirve, y falla en la dirección silenciosa: **por este contrato no
hay forma de borrar una tasa** (`operation` se ignora y un `DELETE` inserta otra fila), así que una
moneda que el comercio desactiva conserva sus tasas para siempre y seguiría apareciendo en el
escaparate. Además sería la misma definición escrita con otras palabras en dos bases de datos de dos
organizaciones, que es exactamente lo que nos ha mordido antes.

**Lo que pedimos.** Un campo explícito con la lista de códigos a mostrar —`displayCurrencies:
["CUP","USD","EUR"]`— escrito por cuadrecaja. A nivel de negocio si tenéis dónde ponerlo; si no, en
el `payload` de `STORE`, aunque el dato sea del negocio y no de la sucursal.

**Dos condiciones de las que depende que esto se vea bien:**

- **El redondeo tiene que ser el mismo que el del checkout.** Nosotros fijamos half-up alejándose del
  cero al céntimo con enteros escalados, y el contrato promete que recomputar `unitPrice` con las
  tasas del `rateSnapshot` da el mismo céntimo. Si la estantería redondea de otra forma, el comprador
  ve un céntimo de diferencia entre lo que miró y lo que paga. Y las conversiones entre dos monedas
  que no son CUP tienen que pasar **por CUP**, que es el ancla.
- **La caché (S-004).** Pintar N precios convertidos en una página que revalida cada 3600 s es
  mostrar N números potencialmente viejos en vez de uno. Nuestra sugerencia: el **precio canónico** se
  pinta en su moneda y ése manda; los **equivalentes** se calculan en el cliente contra un endpoint
  de tasas de TTL corto y se marcan como aproximados (`≈ 12 000 CUP`). Así el HTML cacheado nunca es
  incorrecto —el precio canónico no depende de ninguna tasa—, el número aproximado no pretende ser el
  precio, y S-004 deja de estar en el camino crítico.

**Referencia útil.** El patrón ya está resuelto y en producción de nuestro lado, por si os sirve como
punto de partida: `useMonedasAlternativas` filtra las monedas del negocio por `activo`, descarta la
base y descarta las que no tienen tasa vigente; `MultiCurrencyAmount` las pinta.

**Qué bloquea.** Ningún feature todavía: el del escaparate multi-moneda está por definir en el
backlog, a la espera de esta conversación.
