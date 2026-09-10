# Solicitudes abiertas al equipo de queandabuscando

Cosas que el contrato exige o presupone y que su API no ofrece hoy. Cada una bloquea features
concretos de [`features.json`](features.json). Se registran aquí para que no se pierdan entre
conversaciones y para que el bloqueo tenga una causa nombrada.

Al resolverse: anotar la versión del contrato que la incorpora, desbloquear los features
afectados y borrar la entrada de la tabla de abiertas.

## Abiertas

**Ninguna.** S-007 pasó a resueltas el 2026-09-10: la v13 la concede, y con ella se cierran los
nueve puntos y los cinco menores de la revisión del 2026-09-09 salvo dos, que quedan anotados abajo
como **residuos** — no como solicitudes nuevas, porque abrir una es decisión del humano.

**Lo que no está resuelto no es una solicitud, es un estado: la v13 es un BORRADOR sin publicar.**
Mientras no retiren el aviso, `entity` no admite `ZONE_TARIFF` y emitirlo se lleva el lote entero
con un `400 INVALID_BATCH`. La forma ya se puede especificar, diseñar e implementar; la **emisión**
espera. Es el mismo camino que `BUSINESS` recorrió entre la v11 y la v12.2, y es la razón de ser de
`QAB_OUTBOX_WITHHELD_ENTITIES`.

## Resueltas

| # | Qué faltaba | Resuelta en | Cuándo |
|---|-------------|-------------|--------|
| S-001 | Releer un pedido concreto sin depender del cursor | contrato v8 (F-033 de QAB) | 2026-09-03 |
| S-002 | Qué hace el SQL espejo con un producto borrado en blando | contrato v11 (§ ⑤, quinta decisión) | 2026-09-06 |
| S-003 | El claim `email` del SSO exige forma de correo y el contrato no lo dice | **en cuadrecaja: F-023**. No se pidió nada a QAB | 2026-09-06 |
| S-004 | `EXCHANGE_RATE` no invalida la caché del catálogo público | contrato v11 ① | 2026-09-06 |
| S-005 | `EXCHANGE_RATE` no tiene guarda anti-rancio | contrato v11 ② | 2026-09-06 |
| S-006 | Un fallo por evento no arrastra a sus dependientes del mismo lote | contrato v11 ③ | 2026-09-06 |
| S-008 | El escaparate no sabe qué monedas mostrar (`displayCurrencies`) | contrato v12, afinada en la v12.1, **en pie desde la v12.2** | 2026-09-06 |
| S-007 | Envío por zonas: `ZONE_BASED`, tarifario por zona y `contact.zoneCode` | contrato **v13** (F-041 a F-045 de QAB) — borrador, la emisión aún no | 2026-09-10 |

Las cuatro de la v11 se concedieron **enteras y en una sola versión**, y la v11 se publicó
**antes de estar construida** del lado de queandabuscando: está acordada, no en pie. QAB avisa
feature a feature. Ver `estado_del_lado_receptor` en `features.json`.

**S-008 se concedió igual: publicada antes de estar construida — y desde el 2026-09-10 ya está en
pie.** La v12.2 dice que `entity` **acepta** `BUSINESS` (su F-038 construido) y retira de los tres
sitios el aviso de no emitirlo. Ese aviso era lo único que esperaba el interruptor de F-027:
**vaciar `QAB_OUTBOX_WITHHELD_ENTITIES` en `src/constants/qab.ts` es todo lo que queda**, y el
atraso de eventos encolados drena solo. Ver la solicitud.

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

### S-002 · El SQL espejo no dice qué hacer con un borrado en blando — RESUELTA en la v11

> **Cerrada el 2026-09-06.** Confirmado en la dirección que esta solicitud proponía: **el espejo
> del § ⑤ no cuenta las filas dadas de baja**, y la exclusión es responsabilidad del lado que
> tiene la columna. El SQL publicado ya lleva `AND p."deletedAt" IS NULL AND pt."deletedAt" IS
> NULL`, y la razón queda escrita como la **quinta decisión** de esa sección, con las mismas
> palabras que se pidieron: un espejo que cada lado ajusta por su cuenta para que le cuadre deja
> de detectar lo que existe para detectar.
>
> Es la única de las cuatro de la v11 que por su letra habría sido una menor —no cambia lo que el
> POS envía ni recibe—; va en la mayor porque la v11 se abría igualmente.
>
> **Desbloquea F-008**, que estaba de hecho detenido por esto aunque su `status` fuera `pending`.
> Lo demás del § ⑤ no se movió: el vector de prueba sigue dando `products = 4` y
> `hash = 62e399684e3a8eafadaae58391537955`, el orden sigue siendo `COLLATE "C"` y el
> `coalesce(pt."dispPublicada", 'AVAILABLE')` sigue en su sitio. **El SQL a copiar es el de la
> v11, no el que se copiara antes: son dos condiciones más en el `WHERE`.**

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

### S-004 · `EXCHANGE_RATE` no invalida la caché del catálogo público — RESUELTA en la v11

> **Cerrada el 2026-09-06, con las dos condiciones que se pusieron.** Aplicar un `EXCHANGE_RATE`
> expira las páginas cacheadas de las sucursales del negocio dueño de la tasa; un `CURRENCY`
> expira las del negocio que lo emite —su tabla es global y el evento no lleva `businessId`, así
> que el emisor es lo único que hay— y basta, porque hoy ninguna página pública lee esa tabla.
>
> - **Coalescido por lote y por sucursal**: las tres o cuatro monedas de un mismo drenaje
>   producen UNA invalidación por sucursal, no una por moneda.
> - **Alcance por negocio, nunca global.**
>
> **Lo que no promete, y conviene no prometerlo aguas abajo: instantaneidad.** Invalidar es
> expirar la marca, no repintar: la vitrina se rehace en la primera visita posterior. La ventana
> deja de ser de hasta una hora y pasa a ser la de una petición, que es lo que se pedía.
>
> El checkout no cambia: seguía y sigue leyendo tasas frescas en cada pedido.
>
> **Consecuencia sobre S-008**, que esta solicitud dejaba anotada: con ① concedida, los
> equivalentes multi-moneda se pueden pintar **en el servidor** sin quedarse viejos. Decae el
> apaño de convertir en el cliente contra un endpoint de tasas de TTL corto, y con él la
> necesidad de publicar ese endpoint. No hay nada que hacer de este lado.

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

### S-005 · `EXCHANGE_RATE` no tiene guarda anti-rancio — RESUELTA en la v11

> **Cerrada el 2026-09-06, y en la variante que se prefería**, no en la del rechazo. La tasa
> vigente de un par `(negocio, moneda)` pasa a ser **la de `updatedAt` mayor**; en un empate
> exacto gana la última que llegó.
>
> Lo que NO cambia, y es la mitad de la decisión:
>
> - **Sigue siendo append-only.** Cada evento inserta su fila, no se borra nada, el histórico
>   queda completo y no hay hueco — la tercera pregunta de esta solicitud queda sin objeto.
> - **No hay vocabulario nuevo.** Una tasa rancia se inserta igual y responde `processed`: no
>   vuelve en `failed[]` y **no gasta ninguno de los seis intentos del outbox**, que era
>   exactamente lo que la variante de rechazo habría costado (ADR 0011 de cuadrecaja).
> - **Corregir una tasa sigue siendo enviar otra**, ahora con un `updatedAt` mayor.
>
> **LO QUE ATA A CUADRECAJA, y es lo único que la v11 pide de código en esta parte:
> `updatedAt` deja de ser decorativo en `EXCHANGE_RATE`.** Tiene que ser el instante real en que
> el comercio registró la tasa — no el del reenvío, no el `now()` del drenaje. Un evento
> reintentado con la marca refrescada resucitaría la tasa vieja, que es justo el fallo que la v11
> cierra. **Verificado el 2026-09-06: cuadrecaja ya lo cumple** — `POST
> /api/negocio/[id]/tasas-cambio` fija `occurredAt = new Date()` antes de la transacción y lo pasa
> tal cual a `emitQabExchangeRateEvent`, y el drenaje no reescribe ningún `payload`. No hay nada
> que cambiar; sí algo que no romper.
>
> `CURRENCY` **no cambia**: gana el último que llegue, y se convive con ello porque el nombre de
> una moneda no cambia casi nunca.
>
> **La mitigación local de esta solicitud sigue en pie** —cancelar los `EXCHANGE_RATE` pendientes
> del mismo par al encolar uno nuevo—: el propio contrato dice que la guarda de la v11 no la
> sustituye, que cubren cosas distintas y que son dos capas y no dos candidatas. Es la parte A de
> **F-028**.

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

### S-006 · Un fallo por evento no arrastra a los que dependían de él en el mismo lote — RESUELTA en la v11

> **Cerrada el 2026-09-06.** Si un evento falla, los eventos **posteriores del mismo lote** que
> dependen de él no se aplican: vuelven en `failed[]` con `error: "DEPENDENCY_FAILED_IN_BATCH"`.
> No se aplican a medias, no se aplican con la referencia a `NULL` y no dejan ninguna fila
> provisional.
>
> Las dependencias reconocidas son **dos, y solo dos**:
>
> | Falla | Arrastra, dentro del mismo lote y solo hacia adelante |
> |---|---|
> | `CATEGORY` | los `PRODUCT` cuyo `localCategoryId` es el `categoryId` de esa categoría |
> | `CURRENCY` | las `EXCHANGE_RATE` cuyo `currency` es el `code` de esa moneda |
>
> **`CURRENCY` NO arrastra a `PRODUCT`, y no es un olvido**: esta solicitud pedía las tres
> parejas y se concedieron dos. Un `PRODUCT` guarda el código de moneda tal cual, sin clave ajena
> y sin comprobación, así que un producto en una moneda que nadie declaró se publica igual y
> correctamente. La fila provisional `USD / USD` la crea **solo** una `EXCHANGE_RATE`.
>
> Tres límites que hay que leer antes de contar con esto:
>
> 1. **Solo dentro del lote y solo hacia adelante.** Una categoría que **nunca llegó** sigue
>    dejando el producto publicado con `localCategoryId: NULL`, igual que en la v10.1. La cascada
>    evita aplicar mal; no repara lo ya aplicado mal.
> 2. **El arrastrado nunca llegó a aplicarse, así que se reintenta TAL CUAL, con su `updatedAt`
>    original.** La trampa de la marca nueva que esta solicitud dejaba anotada es de la reparación
>    *a posteriori*, no de esto — y **aquí fabricar una marca nueva es el error**.
> 3. **Mientras la dependencia siga fallando, el dependiente deja de existir en vez de existir
>    mal.** Si un `CATEGORY` agota los reintentos, sus `PRODUCT` los agotan detrás y el
>    comerciante no ve el producto en absoluto, donde antes lo veía sin categoría. Es el precio de
>    la regla, y el contrato lo dice entero.
>
> **LO QUE ATA A CUADRECAJA:** tratar `DEPENDENCY_FAILED_IN_BATCH` como «todavía no» y no como
> «mal» — reintentarlo tal cual y **que no gaste el contador de intentos como un fallo propio**,
> porque si el corte del outbox lo trata como los demás, un `CATEGORY` que tarde varias corridas
> se lleva por delante a sus productos. **Hoy no se cumple**: `planOutboxAck` mete toda entrada de
> `failed[]` en `failedAcks` con su `intentos++`, sin distinguir códigos. Es trabajo nuevo, y
> **cambia la forma de la parte B de F-028** — ver la nota de ese feature.

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

### S-007 · Envío por zonas: `ZONE_BASED`, tarifario por zona y `contact.zoneCode` — CONCEDIDA en la v13 · revisada el 2026-09-10

> **CONCEDIDA. El contrato está en v13.4 y las zonas ya son contrato**, con una condición de estado
> que no es un matiz: **el documento es un BORRADOR sin publicar y la emisión sigue prohibida**
> hasta que retiren el aviso. Lo que falta de su lado es su **F-041** —aceptar `ZONE_TARIFF` en
> `entity`, `ZONE_BASED`, `STORE.zoneCode` y la precedencia—, que se está terminando de implementar
> y verificar; su **F-042** (selector, mapa y el pedido llevando `zoneCode`/`zoneName`) ya está
> construido, y **F-043**, **F-044** y **F-045** están aplicados en el documento.
>
> **De los nueve puntos de la revisión del 2026-09-09 se conceden ocho, y los dos graves enteros:**
>
> 1. **Concedido en la v13.2 (su F-043).** Una zona desconocida —ausente del catálogo **o sin la
>    forma del DPA**— ya no es `400 INVALID_BATCH`: falla **solo ese evento**, en `207 failed[]` con
>    `ZONE_TARIFF_ZONE_UNKNOWN`/`STORE_ZONE_UNKNOWN`. Y lo argumentan midiendo **este** código:
>    `planOutboxAck` suma `intentos++` a todas las filas del lote, no a la culpable.
> 2. **Concedido en la v13.4 (su F-044).** El tarifario entra en la reconciliación: la respuesta de
>    ⑤ pasa a `{products, hash, tariffs, tariffHash}`, con pseudocódigo, SQL espejo y vector propios.
>    Eligieron la primera de las dos vías que se ofrecían. **Con un límite escrito: la divergencia
>    del tarifario SOLO ALERTA** — no hay query convergente ni acción de recuperación, `DELETE` está
>    prohibido, y la única corrección es un `ZONE_TARIFF` con `INHERIT` y `updatedAt` posterior.
> 3. **Concedido.** `STORE → ZONE_TARIFF` es la tercera flecha de dependencia intra-lote, con
>    `DEPENDENCY_FAILED_IN_BATCH` y **nunca** `skipped_not_published`. No cuesta código aquí: la
>    parte B de F-028 reconoce el código por igualdad exacta y no cablea parejas.
> 4. **CONCEDIDO A MEDIAS, y es el primer residuo.** El **padre** ya no se deduce de los dos
>    primeros dígitos: viene declarado como `provinceCode` del catálogo. Pero **no hay `parentCode`
>    ni cadena de padres**: la precedencia son dos escalones cableados (municipio → su provincia →
>    no servida) y una zona de primer nivel solo la decide su propia fila. **Consecuencia: el
>    segundo nivel opcional por debajo del municipio —consejo popular / reparto, que la decisión 1
>    del 2026-09-06 pedía por La Habana— NO es aditivo.** Meterlo después invalida el vector y las
>    dos implementaciones.
> 5. **Concedido.** El vector son **trece** casos: los diez de precedencia con su camino completo
>    (`V1`-`V10`) más las tres guardas de importe como casos ejecutables (`G1`-`G3`). Y ofrecen
>    publicar la **unión** si aquí aparecen casos que allí no están, nunca la intersección.
> 6. **Concedido tal cual.** El contrato publica el `sha256` del bloque JSON del vector, con los
>    bytes exactos sobre los que se calcula, para que el test de aquí fije su copia commiteada
>    contra ese número y no contra un fichero que no está en este disco.
> 7. **Concedido, en su § «Respuesta al P7».** `ZONE_BASED` con `deliveryFee` puesto se acepta y el
>    importe se **ignora**; `ZONE_BASED` con domicilio y **cero** filas de tarifario es **legal** y
>    simplemente no ofrece domicilio; y el pie de plomo queda con letra: pasar de `FLAT_RATE` a
>    `ZONE_BASED` **apaga el domicilio en el acto**, sin gracia ni herencia. Es lo que F-016
>    necesitaba por escrito.
> 8. **CONCEDIDO A MEDIAS.** El **índice** tiene versión (`1.0.0`), `sha256` y ruta dentro de su
>    repositorio (`src/features/zones/zone-index.json`, **fuera** de su `docs/` y por tanto fuera de
>    `QAB_DOCS_PATH`; los bytes viajan adjuntos al borrador). La **geometría** no tiene ni versión
>    ni hash publicados — y para este lado eso ya no importa: el mapa lo pinta su F-042, y 184
>    códigos se eligen de una lista.
> 9. **Concedido.** Los tres códigos van a § Vocabulario de errores con su clase escrita.
>    `ZONE_TARIFF_DELETE_NOT_SUPPORTED` es **permanente**; los dos `*_ZONE_UNKNOWN` son
>    **reintentables y SÍ gastan intento** (no son diferidos). Un cuarto,
>    `ZONE_TARIFF_FEE_NOT_ALLOWED`, vive en `issues[].message` de un `400` del sobre y es permanente.
>
> **Los cinco menores, los cinco concedidos:** `ZONE_TARIFF.deliveryFee` con las mismas reglas que
> `STORE.deliveryFee`; `contact.zoneCode`/`zoneName` **siempre presentes**, `string | null`, y
> obligatorias de hecho en un domicilio `ZONE_BASED`; `zoneCode` **siempre municipio**, nunca
> provincia; el `storeId` de otro negocio contestado **ejecutando** contra Postgres con dos negocios
> —`skipped_not_published` en `ok`, byte a byte igual que una tienda inexistente—; y el § rancio de
> la v12.2 reescrito como registro histórico.
>
> **Segundo residuo, y no se pidió: el pedido no trae coordenadas del comprador.** `contact` gana
> `zoneCode` y `zoneName`, y nada más. Las `contact.lat`/`lng` que la v11 daba por acordadas no
> están en la v13, así que **la distancia geodésica de las decisiones 5 y 6 del 2026-09-06 no tiene
> dato de entrada en el cable**. Coherente con «el precio sale del tarifario y nunca de la
> distancia», pero la señal secundaria para ordenar y avisar se queda sin fuente.
>
> **Lo que esta revisión deja para el humano, y no es petición a nadie:** decidir si los dos
> residuos se piden — serían **S-009** (`parentCode` y la cadena de padres, sin la cual el segundo
> nivel por debajo del municipio no es aditivo) y **S-010** (coordenadas del comprador en el pedido,
> sin las cuales la distancia geodésica no tiene dato de entrada).
>
> **La rama de zonas ya está en el backlog** (2026-09-10, con el visto bueno del humano): **F-039**
> catálogo y precedencia — lo único empezable sin esperar el aviso —, **F-040** `ZONE_BASED` y
> `Tienda.zoneCode`, **F-041** el tarifario y su emisión retenida, **F-042** el espejo del
> `tariffHash`, **F-043** la zona del comprador en el pull, y **F-044** el punta a punta, que es el
> único `blocked` porque necesita el aviso. **F-026 queda `deprecated`** y F-044 lo reemplaza: la
> mitad de su descripción —el comprador eligiendo sobre un mapa, y su criterio 8 midiendo teselas—
> es hoy el F-042 de QAB y está construido de su lado. Sus criterios no se editaron: se repartieron.

### S-007 · El registro de la revisión anterior — borrador de la v13 revisado el 2026-09-09

> **BORRADOR DE LA v13 REVISADO EL 2026-09-09 · OK a la forma, condicionado a nueve puntos.** No
> hay v13 todavía: `docs/sync-contract.md` sigue en **v12.2** y solo reserva el número. Lo revisado
> es el borrador tal como existe hoy —su propuesta `.agent/specs/propuestas/zonas-de-envio.md` en
> estado `aceptada`, con SP1, SP2, SP3 y SP5 cerradas, más los criterios de aceptación de sus
> **F-041** y **F-042**—.
>
> **La forma se firma casi entera y no se reabre nada de lo cerrado el 2026-09-06:** el
> discriminante `rule` en vez de dos banderas, matar el `DELETE`, `INHERIT` como único mecanismo de
> retracción en cualquier nivel, la simplificación **topológica** en una sola operación, el nivel
> declarado en vez de deducido, el id de OSM guardado para que la unión por nombre ocurra una vez en
> la vida, y el código retirado que no se reutiliza nunca. Nada de eso se discute.
>
> **Lo que falta antes de publicar, en orden de gravedad.** Los dos primeros no son matices: uno nos
> rompe el drenaje en producción y el otro cobra dinero equivocado en silencio.
>
> **1. `ZONE_TARIFF` de zona desconocida como `400` es una píldora envenenada para nuestro outbox.**
> El borrador se contradice: para `STORE.zoneCode` dice «en `failed[]` y nunca como `400` de lote»,
> y para `ZONE_TARIFF` dice «`400` con nombre propio» (criterio 6 de su F-041). Medido de este lado:
> un `400` llega como `outcome.kind === "error"` y `planOutboxAck` (`src/lib/qab/outboxAck.ts`) le
> pone `intentos++` a **todas** las filas del lote, no a la culpable; con
> `QAB_OUTBOX_MAX_ATTEMPTS = 6`, una sola divergencia de un municipio quema seis intentos de cada
> `PRODUCT` y cada `STORE` que viaje con ella y después **el drenaje no los vuelve a reclamar
> nunca**. Y es justo el caso que va a ocurrir: la divergencia de catálogos es la razón de existir de
> ese código. **Pedimos `failed[]` con su código, igual que `STORE`.**
>
> **2. El tarifario no tiene espejo ni relectura, y es lo único del cable que es un precio.** El hash
> del § ⑤ cubre productos —`precio`, `moneda`, `disponibilidad`— y el tarifario queda fuera. Si un
> `ZONE_TARIFF` se abandona tras sus seis intentos, este lado cree que lo mandó, el encargado ve su
> tabla, y queandabuscando cobra otro importe **para siempre y sin ruido**. En productos eso es un
> catálogo viejo; aquí es dinero. **Hace falta una de las dos:** que el tarifario entre en la
> reconciliación con su propio hash por sucursal, o un `GET` de relectura del tarifario aplicado
> —hay precedente con la consulta de disponibilidad—.
>
> **3. Falta la tercera flecha de dependencia: `STORE → ZONE_TARIFF`.** Las filas mueren con la
> sucursal **por clave ajena**, así que un `ZONE_TARIFF` que llegue antes que su `STORE` —o en el
> mismo lote, detrás de un `STORE` que falló— revienta contra la FK. La lista de la v11 ③ tiene dos
> flechas y solo dos, y la parte B de nuestro F-028 solo perdona el contador para
> `DEPENDENCY_FAILED_IN_BATCH`. **Hay que decidirlo escrito:** o es una tercera flecha, o es un
> código propio en `failed[]`; en los dos casos, **reintentable sin gastar intento**. No es
> hipotético: dar de alta un negocio emite el `STORE` y sus tarifas casi a la vez.
>
> **4. La jerarquía se sigue deduciendo de los dos primeros dígitos.** Se mató muy bien la deducción
> del **nivel** por longitud del código, y quedó viva la del **padre**: el propio borrador escribe
> que nuestro test de integridad comprobará «que los dos primeros dígitos de cada municipio
> correspondan a una provincia presente en el mismo fichero». Es el mismo fallo un campo más allá, y
> lo estaríamos haciendo los dos lados. **Pedimos `parentCode` explícito en el índice**, y la
> precedencia redactada como «sube por la cadena de padres hasta que alguien decida» en vez de
> «municipio → provincia». Eso además recupera gratis el **tercer nivel opcional** que esta
> solicitud pedía y que el borrador dejó caer sin nombrarlo: con la cadena de padres, un nivel más es
> aditivo; con dos escalones cableados, invalida el vector y las dos implementaciones.
>
> **5. El vector: dicen siete y son diez, y las tres guardas no están dentro.** Su § «Datos y
> contrato» y el criterio 1 de F-041 dicen **siete casos**; su § «El vector, cruzado» dice **diez,
> con el camino completo por caso**, y sus propias notas admiten que eso «todavía no está en los
> criterios de arriba». Publicar siete sin el camino tira justo lo que descubrió el cruce a ciegas
> —`0303` y `0304` los decide la misma fila por caminos distintos—. Y las tres guardas
> —`FEE` sin importe no decide, **0 es envío gratis** con la comprobación contra `null` y nunca
> contra un falsy, y negativo se rechaza y tampoco decide— viven solo en prosa. **Deben ser casos
> del vector:** lo que no se ejecuta, no se cruza.
>
> **6. Nuestro test no puede leer el vector del propio contrato, y eso está escrito como acuerdo de
> los dos lados.** Ellos sí pueden: el contrato vive en su repositorio. Aquí se resuelve por
> `QAB_DOCS_PATH`, no hay CI, y nuestra propia regla prohíbe adivinar rutas — un test que se salta a
> sí mismo cuando la variable falta es decorativo, que es exactamente lo que nuestro `qa` caza.
> **Solución barata: que el contrato publique el hash del bloque JSON del vector**, y nuestro test
> fija la copia commiteada contra ese hash. Se conserva la propiedad que importa —una copia editada
> a mano falla— sin exigir un fichero que no está en nuestro disco.
>
> **7. `ZONE_BASED` contra el guarda de la v7 no está especificado.** Hoy `deliveryEnabled: true` +
> `FLAT_RATE` + `deliveryFee: null` es `400 INVALID_BATCH`, y `STORE_DELIVERY_CONFIG_INCONSISTENT` ya
> está en nuestro `QAB_OUTBOX_PERMANENT_ERROR_CODES`. Nadie dice qué pasa con `ZONE_BASED` **más un
> `deliveryFee` puesto** —¿incoherente y tumba el lote, o se ignora?— ni si `ZONE_BASED` + domicilio
> habilitado + **cero filas de tarifario** es legal. Nuestra pantalla de F-016 valida antes de
> encolar precisamente para no tumbar lotes, así que necesita la respuesta escrita. Y si es legal,
> que vaya con letra: pasar de `FLAT_RATE` a `ZONE_BASED` **apaga el domicilio** hasta que haya
> tarifas, y ese pie de plomo del comerciante hay que diseñarlo, no descubrirlo.
>
> **8. Del catálogo falta el transporte, no la forma.** SP2 cerró bien la mitad del código retirado.
> La otra mitad —«cómo sabe cada lado que comparte versión»— se queda en «la versión se publica en
> este documento» y en «su versión está anotada», que no dice **dónde viven los bytes** ni cuántas
> versiones hay. Son **dos** artefactos con vidas separadas: **el contrato tiene que publicar versión
> y hash de los dos** —índice y geometría— y nombrar la ruta dentro de su repositorio de donde
> salen los bytes exactos.
>
> **9. Cada código de error nuevo, con su clase escrita: permanente o reintentable.** Nuestro outbox
> se comporta según esa clasificación (`QAB_OUTBOX_PERMANENT_ERROR_CODES` y los diferidos), y hoy
> habría que inferirla leyendo prosa.
>
> **Menores, de una línea cada uno:**
>
> - `ZONE_TARIFF.deliveryFee`: basta con «mismas reglas que `STORE.deliveryFee`» —rango, dos
>   decimales, moneda implícita—. Hoy es un número desnudo.
> - ¿`contact.zoneCode` y `contact.zoneName` son opcionales siempre, u obligatorios en un pedido de
>   una tienda `ZONE_BASED`? Nuestro schema Zod sale bien o mal de esa frase.
> - ¿`contact.zoneCode` puede ser alguna vez un código de **provincia**, o siempre de municipio? El
>   paso de provincia parece navegación y no selección, pero no está dicho.
> - `ZONE_TARIFF` con un `storeId` de otro negocio: confirmar que sigue la regla del § ⑤
>   (`404 UNKNOWN_STORE`, indistinguible de inexistente). Es frontera entre tenants y no debería
>   quedar implícita.
> - El § «Nuestra postura sobre las solicitudes» de la v12.2 está **rancio** en lo que toca a zonas:
>   todavía propone el selector jerárquico con el mapa «si se demuestra que hace falta», todavía dice
>   `400` para la zona desconocida, y su párrafo de S-008 propone repetir el patrón de `STORE` que la
>   propia v12 descartó. Es el documento que leen los dos equipos.
>
> **Lo que esta revisión deja anotado de este lado, y no es petición a nadie:**
>
> - El contrato subió a **12.2** (menor, aditiva: `entity: "BUSINESS"` ya se acepta y **retiran el
>   aviso de no emitirlo**). Ese aviso era lo único que esperaba el interruptor de F-027.
> - **F-026 está redactado contra el mundo de antes:** su descripción pone al comprador eligiendo
>   sobre un mapa y su criterio 8 mide teselas, y esa mitad es hoy su F-042. No se toca —la regla del
>   backlog lo prohíbe—, pero cuando la v13 salga habrá que abrir el feature de migración.

> **Revisada el 2026-09-06 contra la v12: NO entra, y por primera vez eso no significa que siga en
> discusión.** La forma se negoció y se cerró **entera** ese mismo día, y está publicada como
> propuesta del lado de QAB en `.agent/specs/propuestas/zonas-de-envio.md` (en **su** repositorio el directorio es `.agent/`, en singular; el `.agents/` de este documento es la convención de este repositorio). Será la **v13**. Lo que
> falta no es un acuerdo: son **tres decisiones de diseño** de su lado —el formato del catálogo, su
> versionado (incluido qué pasa con un código que muere en una versión nueva) y calcular el vector
> ejecutando—. F-013, F-016 y F-026 siguen `blocked`, y nada de esto es implementable: no hay
> `ZONE_BASED`, no existe `ZONE_TARIFF` y `contact` sigue teniendo cuatro claves.
>
> **Estado del lado de QAB al 2026-09-06:** su humano aceptó la propuesta y entró en su backlog como
> **dos features** — **F-041**, el contrato y lo que no ve nadie (`ZONE_BASED`, `ZONE_TARIFF`, el
> catálogo, `STORE.zoneCode` y la función de precedencia con su vector), y **F-042**, el checkout que
> ve el comprador (selector, mapa por cobertura declarada, y el pedido llevando `zoneCode` y
> `zoneName` hasta nuestro pull). **Aceptar no es publicar:** la v13 sigue sin salir y lo que la
> bloquea son las tres decisiones de diseño, anotadas de su lado como SP1 (formato del catálogo),
> SP2 (cómo sabe cada lado que comparte versión, y qué pasa con las filas que apuntan a una zona que
> desapareció) y SP3 (calcular el vector ejecutando). Y van **después** de sus F-035 a F-038, así
> que no es pronto. **SP3 no depende de nosotros**: QAB entrega el vector ya resuelto en el JSON del
> contrato. Ofrecen dos cosas que son decisión del humano de este lado: diseñar SP1 y SP2 juntos en
> vez de dos veces, y que calculemos el vector por separado para cruzarlo con el suyo antes de
> publicarlo.
>
> **SP1 y SP2 quedaron CERRADOS el 2026-09-06**, diseñados a cuatro manos por decisión del humano
> de este lado. Falta solo SP3 del lado de QAB —generar—, más la revisión humana de la unión de
> arranque. Lo acordado:
>
> - **Autoridad repartida:** la lista oficial **DPA/ONEI manda en códigos y nombres**; **OSM manda
>   en la geometría y en nada más**. El hallazgo que lo obligó es de QAB y ninguno de los dos lo
>   había nombrado: **el `code` NO sale de OSM**, así que hay que unir los polígonos con la lista
>   oficial, y esa unión se hace **por nombre** — acentos, «La Habana» contra «Ciudad de La Habana»,
>   homónimos en provincias distintas. Un código mal asignado **no lo detecta ningún hash**: los dos
>   ficheros serían internamente consistentes y el comercio cobraría la tarifa de un municipio a
>   otro, para siempre.
> - **La unión por nombre ocurre UNA VEZ EN LA VIDA.** El artefacto guarda **el id de la relación de
>   OSM** de cada zona, así que toda regeneración une **por id** y la revisión humana pasa de 184
>   filas a un **diff**. Aportación de este lado: sin el id, la revisión se reprograma en vez de
>   cerrarse, porque en la segunda generación nadie revisa 184 filas con atención. Y guarda también
>   **el nombre que tenía en OSM al generarse**, aportación de QAB, para que el diff distinga tres
>   cosas y no dos: id nuevo, id que desapareció, e **id vivo que cambió de nombre** — el único que
>   necesita una persona, porque puede ser una errata o el rastro de un cambio territorial.
> - **Tres identidades por zona, con su papel escrito: `code` DPA/ONEI, id de OSM, y nombre. Por el
>   cable viaja SOLO el `code`.** El id de OSM es identidad de la *regeneración* y no aparece nunca
>   en un `ZONE_TARIFF`, ni en un pedido, ni en una pantalla; el nombre es para las personas.
> - **Simplificación TOPOLÓGICA**, aportación de este lado. Simplificar polígono a polígono deja
>   **huecos y solapes** en la frontera compartida, y el fallo aparece **justo donde se usa el
>   mapa**: el comprador toca su casa en el límite entre Playa y Marianao y el punto no cae en
>   ninguna zona, o cae en dos. Forma accionable: el conjunto se simplifica **en una sola
>   operación**, nunca zona a zona. Dos comprobaciones al generar, y la segunda es la que vale: que
>   la unión de los municipios de una provincia la reconstruya sin huecos, y que **cualquier punto
>   dentro de una provincia caiga en exactamente una** de sus zonas.
> - **El NIVEL de cada zona lo declara el artefacto y NO se deduce de la longitud del código.** Cuba
>   tiene un municipio especial —la Isla de la Juventud— al nivel de una provincia, así que «2
>   dígitos = provincia, 4 = municipio» es una regla que aguanta 183 filas y rompe en la 184. Ver
>   ADR 0091 para el fallo concreto que evita.
> - **La procedencia se escribe junto a los bytes**, y no vale «genéralo con este comando»: OSM
>   cambia a diario, así que un comando es una promesa que no se puede cumplir dos veces. Lleva la
>   edición de ONEI usada, el volcado de OSM exacto con su fecha y suma de comprobación, los
>   `admin_level`, la proyección, la tolerancia y la **precisión decimal** —que es una segunda
>   pérdida y suele olvidarse—, el modo de simplificación, el **recuento** de divisiones de primer
>   nivel y de municipios, las filas que necesitaron mano, y el hash de cada artefacto.
> - **Genera QAB**, una sola extracción para los dos artefactos: si el índice sale de un volcado y la
>   geometría de otro, un municipio puede faltar en uno y **ningún hash lo detecta**, porque los dos
>   ficheros serían internamente consistentes.
> - **El vector de precedencia (SP3) quedó cruzado**: dos implementaciones independientes, calculadas
>   a ciegas, **diez casos idénticos** en importe, fila decisoria y camino. Ver ADR 0091.
>
> **Por qué se partió en dos versiones.** S-008 estaba decidida y esto no; agruparlas era retener la
> decidida como rehén. El número lo decidió nuestro grafo: **F-027 depende de una sola cosa, F-006,
> que ya está en `passes: true`**, mientras que la rama de zonas arrastra cuatro features (F-013,
> del que cuelgan F-015 y F-017, y F-026, que cuelga de F-013, F-016 y F-025). QAB confirmó que
> partir **no retrasa la v13**: lo que marca su calendario son las tres decisiones abiertas, que no
> corren más por tener el documento sin publicar.
>
> **La forma acordada, cerrada y no renegociable salvo que aparezca algo nuevo:**
>
> - **`ZONE_BASED`** como tercer valor de `deliveryFeeMode`, y los modos son **excluyentes**.
> - **`ZONE_TARIFF`** como entidad propia del outbox y **no** un array anidado en `STORE`: el
>   `payload` de `STORE` es un upsert de la fila entera **con guarda anti-rancio**, así que cambiar
>   una tarifa reenviaría la configuración del local y competiría con la guarda.
> - **La fila lleva un discriminante, no dos banderas:**
>   `{ storeId, zoneCode, rule: "FEE" | "NOT_SERVED" | "INHERIT", deliveryFee?, updatedAt }`.
>   `deliveryFee` es **obligatorio** con `FEE` y **prohibido** en las otras dos —presente es `400`,
>   con el precedente de `barcode` de la v4—.
> - **`ZONE_TARIFF` no acepta `DELETE`.** Si llega, vuelve en `failed[]` con su propio código:
>   ruido, no el silencio con el que `CURRENCY` y `EXCHANGE_RATE` ignoran `operation`. Es una
>   decisión de este lado y cierra un agujero real — con `DELETE`, la fila aplicada desaparece, no
>   queda marca contra la que comparar, y **un `UPDATE` rancio posterior resucita la fila** con un
>   importe que el encargado ya retiró. Sin `DELETE` no existe el estado «fila ausente», así que
>   **toda fila conserva siempre su marca y la guarda es total por construcción**.
> - **`INHERIT` a nivel provincia es legal.** Al matar el `DELETE`, `INHERIT` pasó a ser el **único
>   mecanismo de retracción que existe**, en cualquier nivel: un encargado que puso «toda La Habana
>   a 400» y quiere volver a no tener regla de provincia conservando sus excepciones no tiene otro
>   camino. No hace falta regla nueva: «cae al escalón de encima; si no hay, no servida» ya lo
>   cubre.
> - **Precedencia:** municipio con `FEE` → ese importe · municipio con `NOT_SERVED` → no servida ·
>   municipio con `INHERIT` **o sin fila** → cae a la provincia, y si la provincia tampoco resuelve,
>   no servida. **Una fila de provincia declara servidas todas sus zonas.** La resuelve QAB en la
>   consulta, pero **se implementa en los dos lados**, así que va en el contrato con letra y de aquí
>   sale como **función pura en `src/lib/` con su test**.
> - **Un vector de prueba de siete casos, en JSON dentro del contrato**, calculado ejecutando y no a
>   mano. Los tests de ambos lados **leen ese JSON**, no una copia: la transcripción a mano es justo
>   donde las dos implementaciones divergen en silencio.
> - **Las filas mueren con la sucursal**, por clave ajena del lado de QAB, no por un evento de zona.
> - **Upsert con guarda anti-rancio por `updatedAt`**, y **la marca es el instante real de la
>   edición** del encargado, nunca el `now()` del drenaje — la misma regla de la v11 ②, que ya
>   cumplimos por ese camino de código.
> - **`contact.zoneCode`** decide el precio; **`contact.lat`/`lng` opcionales** y no deciden nunca.
> - **`contact.zoneName`**, petición de QAB y buena para *nuestro* usuario: instantánea del nombre
>   como se le enseñó al comprador, igual que `rateSnapshot` congela las tasas. Sin él, el encargado
>   y el mensajero leen un código DPA en vez de «Playa». **Es de lectura humana y nunca se compara,
>   se parsea ni resuelve nada**: el precio y la cobertura salen siempre del `zoneCode`.
> - **`STORE.zoneCode`** de la sucursal. Lo pedimos nosotros al detectar que su precarga se apoyaba
>   en `Store.province`, que **es texto libre tecleado por el comerciante** en los dos schemas y
>   falla más en la capital. Un `zoneCode` inválido **rechaza el evento** con su propio código:
>   sale de un selector sobre un catálogo compartido, así que solo puede estar mal si los catálogos
>   divergen, y esa es una alarma que no se oye bajito.
> - **Catálogo geográfico compartido**, sembrado de OpenStreetMap, identificado por `code` DPA/ONEI.
>   **Los polígonos no viajan**: por el cable va el código.
> - **El comprador elige sobre mapa Y lista**, con la geometría servida **por cobertura declarada de
>   la tienda y no por provincia** —aportación de este lado—: un comercio que reparte en cuatro
>   municipios descarga cuatro polígonos, y el paso de provincia solo aparece cuando la cobertura
>   cruza más de una. Eso disuelve la objeción de peso de JavaScript que QAB tenía, y con ella la
>   única discrepancia que quedaba viva con la decisión (4) de F-026.
> - **La cobertura se ve antes del checkout**, nunca dentro: no se ofrece una zona para luego decir
>   que no.
>
> **Lo que esto obliga en NUESTRA pantalla, y va al contrato de diseño con estas palabras.** Hay dos
> pares que significan cosas opuestas y van a estar a un clic en la misma tabla:
>
> - **Borrar una zona de la lista ≠ declarar que no se entrega ahí.** El encargado va a intentar lo
>   primero cuando quiere lo segundo, porque en su cabeza quitar una zona es borrarla.
> - **Retirar la regla de provincia (`INHERIT`) ≠ declarar la provincia no servida (`NOT_SERVED`).**
>   El segundo apaga la provincia entera.
>
> Y la exigencia que hace utilizable la precedencia: **el encargado tiene que leer su cobertura
> resuelta** —«sirvo estas 14 zonas a estos precios»— y no las cuatro filas que tecleó. Un mecanismo
> de precedencia potente y opaco es peor que no tenerlo.
>
> **El costo asumido, escrito por adelantado para que se pueda releer.** Hoy el catálogo tiene **un
> solo consumidor**: el tarifario. No hay ningún feature de búsqueda ni de informes por zona, ni
> abierto ni previsto, y la distancia sale de las coordenadas y no del catálogo. Se descartó **por
> escrito y no por omisión** la alternativa simple —zonas con nombre libre declaradas por cada
> tienda, sin DPA ni GeoJSON— por cuatro razones: un nombre libre **no se puede dibujar**, y sin
> geometría no hay mapa; es el mismo concepto en dos bases de datos de dos organizaciones, que es lo
> que ya mordió en E-014/E-039; no es más simple, es el mismo problema repartido entre quinientos
> comerciantes, donde nadie lo puede arreglar; y `zoneName` se queda sin sentido si el código *es* el
> nombre. **Si dentro de un año el tarifario sigue siendo lo único que usa el catálogo y mantener su
> versión sincronizada cuesta más de lo que ahorra, la decisión correcta era la otra y esta
> conversación es donde nos equivocamos.** QAB se llevó este párrafo literal a su propuesta.

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

### S-008 · El escaparate no sabe qué monedas mostrar (`displayCurrencies`) — RESUELTA en la v12

> **Cerrada el 2026-09-06, concedida entera y por la vía mejor de las dos.** La señal viaja en una
> **entidad `BUSINESS` propia** —la sexta del outbox— y no repetida en el `payload` de `STORE`, que
> era la propuesta inicial de QAB. La retiraron ellos mismos al ver su coste: con la lista repetida
> por sucursal, habilitar una moneda emite N eventos que **pueden fallar por separado**, y el
> resultado son dos sucursales de la misma marca enseñando listas distintas sin que nada esté roto.
>
> El argumento que cerró el sitio es de este lado y conviene retenerlo, porque vuelve a aplicar
> cada vez que alguien proponga meter un dato de negocio en `STORE`: **desde la v9 un `openingHours`
> malformado rechaza el evento `STORE` entero**, así que la lista de monedas se habría perdido en
> silencio justo en la sucursal con el calendario mal puesto, y el único rastro sería una entrada
> en `failed[]` de un evento que trataba de otra cosa.
>
> **`payload` de `BUSINESS`:** `businessId`, `displayCurrencies` (códigos de 3 caracteres, `[]`
> válido) y `updatedAt`. **No añade dependencia de orden**: la lista de la v11 ③ sigue teniendo dos
> flechas y solo dos. El `Business` ya existe antes de cualquier sync porque lo crea
> `POST /api/provisioning/credential` (v10), y una moneda de la lista sin tasa vigente **no se
> pinta y no falla**, que es lo que evita la flecha.
>
> **Las dos capas de la regla, que es lo que hay que no romper aguas abajo:**
>
> - **La lista no se poda por falta de tasa.** Es una declaración del comerciante, no una lista
>   derivada: ni el ancla, ni la moneda base, ni una moneda sin tasa se caen de ella.
> - **Lo que se omite es el importe que no se puede calcular**, producto a producto y moneda a
>   moneda. El importe en la **moneda base es el primario y el que se cobra**; la moneda de
>   referencia que elige el comprador **se añade, no sustituye**.
>
> Nuestra guarda de validez de cable **no es poda y convive con esto**: el criterio 4 de F-027
> filtra por *forma* de código de moneda, no por tasas. La regla del contrato quedó redactada como
> «no se poda **por falta de tasa**» a petición nuestra, justo para que las dos cosas no se pisen.
>
> **Cuatro decisiones que QAB tomó al escribirlo y que no se habían hablado:** `CREATE` y `UPDATE`
> hacen lo mismo y un `DELETE` se **rechaza** con `BUSINESS_DELETE_NOT_SUPPORTED` (ruido, no el
> silencio de la v10.1); `updatedAt` es guarda anti-rancio; si la base no viene en la lista se
> enseña igual; y no hay tope de longitud, con los duplicados descartados sin error.
>
> **Un código malformado NO mata el lote:** vuelve en `failed[]` con
> `BUSINESS_DISPLAY_CURRENCIES_INVALID` y el resto del lote se aplica. Sigue el camino que abrió
> `openingHours` en la v9 —la lista se valida en el aplicador y no en el schema del sobre— porque
> declararla estricta ahí convertiría un código basura en un `400 INVALID_BATCH` que se lleva por
> delante los otros 499 eventos.
>
> **Lo que corrigió la v12.1, y las tres son nuestras.** La v12 pedía «el `updatedAt` de la fila de
> origen», copiado de las otras cuatro entidades con guarda, y **en `BUSINESS` no hay fila de
> origen**: la lista es un conjunto y ninguna de sus filas es la que cambió. Peor, `NegocioMoneda`
> **no tiene ninguna columna de tiempo**. Quedó escrito como **«el instante en que cambió la lista»,
> fijado dentro de la transacción que la escribe** — el mismo camino de código con el que ya
> cumplimos la v11 ②. Se corrigió también la tabla de § Mapeo de nombres, que decía «los
> `NegocioMoneda` con `activo`» y ahora dice **«más `Negocio.monedaBase`»**.
>
> **Y la trampa que va con ello, escrita en el contrato: la marca NO es el `max()` de los
> `updatedAt` de esas filas.** Si algún día se añade esa columna y alguien la resuelve así,
> **retirar** una moneda **baja** el máximo, el evento legítimo que sigue al cambio llega con una
> marca menor que la guardada, se responde `stale`, y **la retirada no se aplica nunca sin que nada
> falle**. Es el fallo que la v11 ② vino a cerrar, entrando por la puerta de al lado.
>
> **PELIGRO OPERATIVO, y es lo único de la v12 que puede hacer daño antes de estar construida: no
> emitir `BUSINESS` todavía.** `entity` no admite ese valor aún, así que hoy no falla solo — cae en
> el `400 INVALID_BATCH` del schema del sobre y **se lleva el lote entero por delante, incluidos los
> `PRODUCT` que viajaran con él**. QAB avisará cuando el aplicador esté en pie; su orden es F-035,
> F-036 y F-037 primero, que son deuda de la v11.
>
> **Qué significa para F-027, y es una buena noticia:** sus seis criterios se verifican **leyendo la
> fila de `OutboxEvento`**, no llegando a QAB. Así que se implementa y se cierra entero ahora, con
> el **drenaje filtrando los eventos `BUSINESS`** hasta la señal. La funcionalidad queda hecha y
> verificada; lo único que espera es un interruptor. Enviaremos `["CUP"]` y nunca `[]` para el caso
> de solo la base, por el criterio 4.

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
