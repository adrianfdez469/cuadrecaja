# ADR 0091: La lista de monedas es una entidad de negocio, y el tarifario de zonas una fila con un discriminante y sin borrado

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-027 (v12, en pie) · F-013 / F-016 / F-026 (v13, pendiente de publicarse)
**Ampliado por:** [ADR 0092](0092-el-drenaje-retiene-business-en-la-reclamacion-y-la-lista-de-monedas-tiene-un-solo-simbolo.md)
— el **cómo** de las reglas 1 y 2 de aquí: dónde vive el filtro del drenaje, cómo se enciende, cómo
se ve que sigue puesto, y con qué símbolo se fija el instante del `updatedAt`.
**Se apoya en:** [ADR 0060](0060-la-conversion-de-moneda-se-recomputa-con-enteros-escalados-y-nunca-reescribe-unitprice.md) ·
[ADR 0021](0021-el-interruptor-filtra-las-dos-fases-del-cron.md) ·
[E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) ·
[E-039](../../.agents/errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md) ·
[E-018](../../.agents/errors/E-018-la-redaccion-congelada-de-un-criterio-diferido.md)

## Contexto

Dos solicitudes al equipo de queandabuscando —S-007 (envío por zonas) y S-008 (qué monedas enseña el
escaparate)— se negociaron de punta a punta el 2026-09-06. La v12 y la v12.1 del contrato ya
recogen S-008; S-007 quedó con la forma cerrada y espera tres decisiones de diseño del otro lado,
así que será la v13.

Lo que el contrato publica es **el cable**: qué campos viajan y qué responde cada error. Este ADR
recoge lo que ata a cuadrecaja y **no se deduce leyendo el contrato**, porque son consecuencias de
cómo está construido *este* lado: qué instante mandamos, qué función tenemos que escribir por
duplicado, y por qué el drenaje tiene que filtrar un evento que sabemos emitir.

Las tres restricciones del terreno que dan forma a todo lo de abajo:

1. **`NegocioMoneda` no tiene ninguna columna de tiempo.** Ni `createdAt` ni `updatedAt`. La lista
   de monedas de un negocio es un conjunto de filas y ninguna de ellas «es» la lista.
2. **`Negocio.monedaBase` es un `String` no nulo con default `"CUP"`**, sin clave ajena a `Moneda` y
   sin garantía de tener su propia fila de `NegocioMoneda` con `activo`.
3. **`Tienda.provincia` es texto libre** que teclea el comerciante. No es un código, no está
   validado, y la misma provincia llega escrita de cuatro formas distintas.

## Decisión

**Cinco reglas: dos de S-008 y tres de S-007.**

### 1. El `updatedAt` de un `BUSINESS` es el instante en que cambió la lista, y nunca un `max()`

Las otras cuatro entidades con guarda anti-rancio mapean **una fila a un evento**: un `PRODUCT` es
un producto, un `STORE` es una tienda, y «el `updatedAt` de la fila de origen» es una instrucción
clara. En `BUSINESS` **no hay fila de origen**, así que esa instrucción no significa nada. La v12 la
copió igualmente; la v12.1 la corrigió a petición nuestra.

**La marca es el instante del cambio de la lista, fijado dentro de la transacción que lo escribe** —
el mismo camino de código con el que ya se cumple la v11 ② para `EXCHANGE_RATE`, donde el
`ocurridoAt` se fija antes de la transacción y el drenaje no reescribe payloads. Cero columnas
nuevas.

**Y explícitamente NO es el máximo de los `updatedAt` de las filas de `NegocioMoneda`.** Hoy esa
columna ni existe; el día que alguien la añada, el `max()` va a parecer la implementación obvia y es
la mala: **retirar** una moneda **baja** el máximo, así que el evento legítimo que sigue al cambio
llega con una marca **menor** que la guardada, QAB responde `stale`, y **la retirada no se aplica
nunca sin que nada falle**. Es el fallo que la v11 ② vino a cerrar, entrando por la puerta de al
lado.

### 2. El drenaje filtra `BUSINESS` hasta que QAB avise, y eso no bloquea F-027

`entity` todavía no admite `BUSINESS` del lado receptor. Un evento así **no falla solo**: cae en el
`400 INVALID_BATCH` del schema del sobre y **se lleva el lote entero por delante**, incluidos los
`PRODUCT` que viajaran con él.

Los seis criterios de F-027 se verifican **leyendo la fila de `OutboxEvento`**, no llegando a QAB —
están escritos así a propósito. Así que el feature **se implementa y se cierra entero ahora**: se
encola el evento como cualquier otro y **el drenaje lo excluye del lote** hasta que QAB confirme que
el aplicador está en pie. La funcionalidad queda hecha y verificada; lo único que espera es un
interruptor.

### 3. Una fila de tarifario lleva un discriminante, y `ZONE_TARIFF` no acepta `DELETE`

La fila es
`{ storeId, zoneCode, rule: "FEE" | "NOT_SERVED" | "INHERIT", deliveryFee?, updatedAt }`, con
`deliveryFee` obligatorio en `FEE` y prohibido en las otras dos.

**No se emite nunca un `DELETE` de `ZONE_TARIFF`, y QAB lo rechaza si llega.** El tercer estado
—«no tengo opinión sobre esta zona, que herede de la provincia»— es un **valor de la fila**, no una
operación del cable. El motivo es una ventana concreta: aplicado un borrado, la fila desaparece y no
queda marca contra la que comparar, así que **un `UPDATE` rancio posterior resucita la fila** con un
importe que el encargado ya retiró, y ninguna guarda puede oponerse. Sin `DELETE` no existe el
estado «fila ausente»: toda fila conserva su marca y **la guarda es total por construcción**, no por
acordarse de dejar una lápida.

`INHERIT` es legal **también a nivel provincia**, y es el único mecanismo de retracción que existe
en cualquier nivel: sin él, un encargado que puso «toda La Habana a 400» no tendría forma de volver
a no tener regla de provincia conservando sus excepciones por municipio.

### 4. El nivel de una zona lo declara el catálogo, y nunca su longitud de código

`resolveZoneTariff` acepta el catálogo compartido y toma de él **el nivel de la zona y cuál es su
zona padre**. La regla del prefijo DPA —2 dígitos provincia, 4 municipio, los 2 primeros del
municipio son su provincia— queda solo como **comportamiento de arranque** mientras el artefacto no
existe, documentada como tal en el código.

El motivo es un caso real: **la Isla de la Juventud es un municipio especial al nivel de una
provincia**, así que la regla del prefijo aguanta 183 filas y rompe en la 184. Y rompe en silencio:
una zona de primer nivel con un código de cuatro dígitos cuyos dos primeros coincidan con una
provincia real **heredaría la tarifa de esa provincia**, sin error y sin rastro, y el comprador
pagaría un precio que nadie fijó para su zona. Mientras el artefacto no se genere **no se puede
descartar ese caso**, porque el código que ONEI le da a la Isla todavía no se conoce; con el nivel
declarado deja de importar cuál sea.

La primera versión de esta función tenía la regla implícita (`zoneCode.length === 4`). Se corrigió
al cerrar SP1, y el test cubre las dos direcciones —con catálogo no hereda, con la regla de arranque
sí— para que la diferencia sea visible al ejecutar y no una nota.

### 5. La precedencia es una función pura de este lado, espejo de la de QAB, verificada contra su vector

QAB resuelve la precedencia en la consulta —si la resolviéramos nosotros habría que expandir a 168
filas y el mecanismo de la fila de provincia no ahorraría nada—. Pero **el POS tiene que mostrarle al
encargado qué se le va a cobrar a un comprador de cada zona**, así que la misma regla se implementa
en los dos lados.

Va como **función pura en `src/lib/` con su test en `src/__tests__/`**, sin base de datos y sin red,
y el test **lee el vector de siete casos del JSON publicado en el contrato**, no una copia
transcrita: la transcripción a mano es justo donde las dos implementaciones divergen en silencio.

La regla, en cuatro renglones: municipio con `FEE` → ese importe · municipio con `NOT_SERVED` → no
servida · municipio con `INHERIT` **o sin fila** → cae a la provincia · si la provincia tampoco
resuelve → no servida. Una fila de provincia **declara servidas** todas sus zonas.

**La resolución devuelve el camino, no solo la fila que decidió.** Salió del cruce: `decidedBy` por
sí solo no distingue una zona con fila propia que declina de otra sin fila —las decide la misma fila
de provincia y al encargado hay que contarle cosas distintas—, ni una provincia que declinó de una
zona que nadie mencionó. Las dos implementaciones habían caído en lo mismo y coincidían en los diez
importes, así que **el cruce se hizo por separado y aun así casi publica un vector ciego** a lo que
las pantallas tienen que distinguir. `ZoneResolution.path` lleva los escalones consultados y qué dijo
cada uno; es lo que las pantallas renderizan.

**Una fila que el schema del contrato habría rechazado no decide: cae al escalón de arriba.** Vale
para `FEE` sin importe, importe negativo y no finito. La razón no es defensiva sino de coincidencia:
en QAB esa fila nunca se habría escrito, así que su resolución también cae — si la nuestra la
aceptara, las dos divergirían justo en el caso corrupto. Y la comprobación del importe es contra el
tipo, **nunca contra un valor falsy**: una tarifa de `0` es envío gratis, y un `if (!deliveryFee)`
la convertiría en «sin tarifa» y de ahí en el precio de la provincia, en silencio y por una línea
que parece correcta.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `displayCurrencies` repetida en el `payload` de `STORE` (propuesta inicial de QAB) | Habilitar una moneda emite N eventos que pueden fallar por separado: dos sucursales de la misma marca con listas distintas sin que nada esté roto. Y desde la v9 un `openingHours` malformado rechaza el evento `STORE` **entero**, así que el cambio se pierde en silencio justo en la sucursal del calendario mal puesto |
| Que QAB derive la lista de las tasas registradas + la base | Falla en la dirección silenciosa: por este contrato **no hay forma de borrar una tasa**, así que una moneda desactivada conserva las suyas para siempre y seguiría apareciendo. Y sería la misma definición escrita con otras palabras en dos bases de datos de dos organizaciones (E-014 / E-039) |
| `deliveryFee: null` como «no servida» | Mismo nombre y misma forma que el `null` de `STORE.deliveryFee` de la v7, que significa **ausencia de importe** y no **negación de servicio**. Dos significados para una forma es la clase de trampa que este repositorio ya paga en otros sitios |
| `DELETE` de `ZONE_TARIFF` dejando lápida (propuesta de QAB) | Cierra la misma ventana, pero deja un artefacto de borrado que **todo lector tiene que acordarse de filtrar**, y mantiene vivo el camino por el que el encargado que quiere decir «aquí no vamos» acaba borrando la fila. Sin `DELETE`, ese error no depende de que acertemos la pantalla |
| Rechazar `INHERIT` a nivel provincia | Reabre el agujero que acababa de cerrarse: al matar el `DELETE`, `INHERIT` quedó como el **único** mecanismo de retracción, y sin él no hay forma de retirar una regla de provincia. Se propuso desde este lado y se retiró |
| Zonas con nombre libre declaradas por cada tienda, sin DPA ni GeoJSON | Un nombre libre **no se puede dibujar**, así que no hay mapa; es el mismo concepto en dos bases de datos de dos organizaciones (E-014); no es más simple, es el mismo problema repartido entre quinientos comerciantes, donde nadie lo puede arreglar; y `contact.zoneName` se queda sin sentido si el código *es* el nombre |
| Deducir el nivel de la zona de la longitud de su código | Aguanta 183 filas y rompe en la 184: la Isla de la Juventud es un municipio especial al nivel de una provincia. Y rompe en silencio — una zona de primer nivel con código de 4 dígitos que colisione con una provincia real heredaría su tarifa, y el comprador paga un precio que nadie fijó |
| Que cada lado exporte el catálogo de OpenStreetMap por su cuenta | OSM cambia a diario, así que dos exportaciones «de la misma fuente» pueden diferir. Y el `code` **no sale de OSM**: hay que unirlo con la lista ONEI **por nombre**, que es donde fallan los acentos y los homónimos. Un código mal asignado no lo detecta ningún hash, porque los dos ficheros serían internamente consistentes |
| Simplificar la geometría polígono a polígono | La frontera compartida entre dos municipios se simplifica de dos formas distintas y aparecen huecos y solapes: el punto del comprador no cae en ninguna zona, o cae en dos. Y aparece **justo en el límite**, que es donde el mapa se usa |
| Precargar la provincia del comprador desde `Store.province` | Es texto libre tecleado por el comerciante en **los dos** schemas. Falla en silencio y falla más en La Habana, que es donde más pedidos hay. Por eso `STORE` gana un `zoneCode` |

## Consecuencias

**A favor:**

- La guarda anti-rancio de `BUSINESS` es implementable sin añadir ninguna columna, por un camino de
  código que ya existe y ya está verificado.
- El agujero de la resurrección de filas **no existe** en `ZONE_TARIFF` en vez de estar tapado. En
  `CATEGORY`, donde sí existe, el precio es una fila huérfana inalcanzable; aquí habría sido un
  importe cobrado.
- F-027 se cierra entero antes de que el lado receptor esté en pie, sin riesgo para el outbox.
- Los criterios de aceptación de los cuatro features **sobrevivieron intactos** a toda la
  negociación, porque ninguno nombraba el cable (E-018). El criterio 1 de F-027 —«**el** evento», en
  singular— ahora se cumple literal.

**En contra / coste asumido:**

- **Dos implementaciones de la misma regla de precedencia**, en dos organizaciones. El vector
  compartido las ata, pero solo mientras los dos tests lo lean del contrato en vez de copiarlo.
- **`ZONE_TARIFF` es asimétrico respecto a las otras cinco entidades** por no aceptar `DELETE`. Se
  paga una vez al leer el contrato; la ventana se pagaría cada vez que alguien toca ese código.
- **El catálogo geográfico tiene hoy un solo consumidor**, el tarifario, y necesita un responsable y
  una versión comparable en cada lado, indefinidamente. No hay ningún feature de búsqueda ni de
  informes por zona, ni abierto ni previsto. **Si dentro de un año sigue así y mantener la versión
  sincronizada cuesta más de lo que ahorra, la decisión correcta era la alternativa de nombres
  libres.** Queda escrito por adelantado para que se pueda releer, y QAB se llevó este párrafo
  literal a su propuesta.
- La pantalla del tarifario carga con dos pares que significan cosas opuestas y estarán a un clic:
  borrar una zona ≠ no entregar ahí, y retirar la regla de provincia ≠ apagar la provincia entera.

**Impacto en seguridad y escalabilidad:**

- El tarifario es **por sucursal y por negocio**: toda consulta filtra por `negocioId`, y el criterio
  2 de F-026 lo verifica sembrando dos negocios que usan **a propósito** el mismo código de zona.
- **Ningún payload lleva geometría.** Por el cable va el código y nada más; los polígonos son copia
  local de cada lado, sembrada de la misma fuente.
- La fila de provincia evita que una tienda que sirve media provincia necesite ~15 filas, y que un
  cambio de tarifa reenvíe la configuración completa del local.
- El evento `BUSINESS` es **uno por negocio**, no N por sucursal: habilitar una moneda encola una
  fila de `OutboxEvento` y no tantas como locales tenga la marca.
