# ADR ADRIAN-0151: Las cinco columnas de configuración de compra de `Tienda` se llaman como el cable, y su vocabulario no es un enum de Postgres

**Estado:** aceptado
**Fecha:** 2026-09-12
**Feature:** F-016
**Se apoya en:** contrato QAB v13.5, § ① «`payload` de `STORE`», su tabla de propiedad de campos y
§ «De la v7 (F-032)» · ADR 0028 de queandabuscando (`$QAB_DOCS_PATH/adr/0028-configuracion-de-compra-del-pos.md`) ·
[ADR 0032](0032-el-payload-de-store-se-construye-entero-desde-la-fila-persistida.md) ·
[ADR 0047](0047-dos-escalas-decimales-y-dos-helpers.md)

## Contexto

El contrato deja los nombres de las columnas de `Tienda` a cuadrecaja con todas las letras («los
nombres son una **propuesta**: el schema de cuadrecaja es suyo»), y propone cinco en español:
`modoCheckout`, `envioHabilitado`, `costoEnvio`, `modoEnvio`, `horasVencimientoPedido`. Lo que ata
son los nombres del cable: `checkoutMode`, `deliveryEnabled`, `deliveryFee`, `deliveryFeeMode` y
`orderExpiryHours`.

Dos convenciones del repositorio tiran en direcciones distintas:

- El bloque QAB que ya vive dentro de `Tienda` está en español (`publicarEnTienda`, `slug`,
  `descripcion`, `horarios`, `motivoDespublicacion`), porque nació con F-001 dentro de un modelo
  que es de los primeros del POS.
- `AGENTS.md` dice que **el código nuevo se escribe en inglés** —identificadores incluidos— y que
  los nombres heredados se mantienen *donde ya están*, no que se propaguen. Los modelos QAB
  posteriores (`PedidoEntrante`, `PedidoEntranteLinea`, `OutboxEvento` en sus campos nuevos) ya
  están enteramente en inglés.

Y hay una tercera restricción que no es estética: la regla «omitir no es apagar»
([ADRIAN-0152](ADRIAN-0152-el-delta-de-la-configuracion-de-compra-sale-de-la-fila.md)) exige
decidir, campo a campo, **si esta columna cambió y por tanto su clave del cable viaja**. Eso es un
mapa columna ↔ clave recorrido en código, no una lectura de propiedades sueltas. Con nombres
distintos a los dos lados, ese mapa es una tabla de traducción que hay que mantener y que nadie
puede comprobar de un vistazo; equivocarse en una entrada no da error de tipos y su síntoma es
exactamente el fallo que el feature existe para evitar: apagar el domicilio de una tienda que
alguien configuró a mano.

Falta además decidir la forma física de tres cosas que el spec deja abiertas: el tipo de
`deliveryFee` (importe con dos decimales), cómo se representa el vocabulario de los dos enums, y
que la migración sea aditiva (criterio 1).

## Decisión

**(a) Las cinco columnas de `Tienda` se llaman exactamente como las claves del cable:**
`checkoutMode`, `deliveryEnabled`, `deliveryFee`, `deliveryFeeMode`, `orderExpiryHours`. `Tienda`
queda con dos idiomas dentro, a propósito: el bloque viejo no se renombra y el nuevo no se traduce.

**(b) Los dos vocabularios son columnas `String`, no enums de Postgres**, con el vocabulario
declarado en `src/constants/qab.ts` y aplicado por Zod en las dos fronteras (body del `PATCH` y
`payload` del evento). Ninguna escritura llega a la columna sin pasar por uno de esos dos schemas.

**(c) `deliveryFee` es `Decimal? @db.Decimal(14, 2)`**, nulable y sin default. Es la misma escala y
la misma precisión que ya usan los importes de `PedidoEntrante`, y `14 = 12 + 2` es exactamente el
tope que publica el contrato (`<= 999999999999.99`), ya escrito en
`QAB_AMOUNT_MAX_INTEGER_DIGITS`. Las otras cuatro son `String`/`Boolean`/`Int` **no nulables con
default** —`"WHATSAPP"`, `false`, `"FLAT_RATE"`, `24`—, porque en el cable ninguna de las cuatro
acepta `null`.

**(d) La migración es aditiva y se escribe con `prisma migrate dev`, sin retocar el SQL.** Cinco
`ALTER TABLE "Tienda" ADD COLUMN`, cuatro con `NOT NULL DEFAULT` y una nulable. En PostgreSQL ≥ 11
añadir una columna con default es una operación de catálogo: no reescribe la tabla y las filas
existentes leen el default. El criterio 1 se verifica leyendo ese SQL y aplicándolo sobre una base
con filas.

**(e) El valor por defecto se escribe dos veces —en el `@default` de Prisma y en la constante de
`src/constants/qab.ts`— y esa duplicación se asume.** El DSL de Prisma no importa constantes. La
duplicación se ata con una aserción en la suite (`QAB_CHECKOUT_MODE_DEFAULT === "WHATSAPP"` y sus
cuatro hermanas), que es lo que ya hace `qabDecimals.test.ts` con `QAB_AMOUNT_DECIMALS`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Los cinco nombres en español que propone el contrato | Son identificadores **nuevos**, y `AGENTS.md` los prohíbe en español. Además obligan a una tabla de traducción columna ↔ clave del cable justo en el punto donde equivocarse apaga el domicilio de un comerciante en silencio |
| Español por coherencia con el bloque QAB ya existente de `Tienda` | La coherencia se mide contra la regla vigente, no contra lo más antiguo del archivo; si no, ninguna convención nueva entra nunca en un modelo viejo. Los modelos QAB posteriores (`PedidoEntrante`) ya están en inglés |
| Renombrar de paso el bloque QAB viejo de `Tienda` al inglés | Migración con `@map`, o rotura de todos los consumidores de F-001/F-005/F-020, por un feature que solo añade cinco columnas. `AGENTS.md` dice explícitamente que lo heredado se mantiene donde está |
| `enum` de Prisma para `checkoutMode` y `deliveryFeeMode` | Un tercer valor (`ZONE_BASED`, alcance de F-042) pasaría de ser un literal más en una constante a una migración `ALTER TYPE` coordinada. Y no compra nada: la única escritura pasa por Zod, que ya cierra el vocabulario antes de la base |
| `Float` para `deliveryFee` | El contrato rechaza el lote entero por un tercer decimal. Un `Float` guarda sin quejarse lo que luego el cable rechaza, y el error aparece a dos minutos de distancia, en el drenaje, no al guardar |
| `Int` en centavos | Ahorra el `Decimal` a cambio de una unidad distinta a la del cable y a la del resto de importes QAB del repositorio. Una conversión más, en un feature cuyo riesgo es precisamente convertir mal |
| `Decimal(12, 2)` u otra precisión propia | `14, 2` es la que ya usan los importes de `PedidoEntrante` y la que hace que el tope del cable y el de la columna sean el mismo número en vez de dos |
| Columnas nulables las cinco, sin default | Deja que una fila exista sin modo de checkout, un estado que el cable no admite, y traslada a cada lector la pregunta de qué significa `NULL` ahí |

## Consecuencias

**A favor:**
- El mapa columna ↔ clave del cable es la identidad. `collectQabStorePurchaseConfigChanges` compara
  campo a campo y las claves que produce **son** las del `payload`: no hay traducción que revisar,
  ni entrada de tabla que se pueda cruzar.
- El tope del importe deja de ser un literal nuevo: sale de `QAB_AMOUNT_MAX_INTEGER_DIGITS`, que ya
  existía para la misma escala.
- Añadir el tercer valor del enum (F-042) es una línea en una constante y una opción en la
  pantalla. Sin migración, sin `ALTER TYPE`, sin ventana de despliegue coordinada.

**En contra / coste asumido:**
- **`Tienda` queda bilingüe**, y quien lea el modelo entero verá `publicarEnTienda` al lado de
  `checkoutMode`. Es el precio de no renombrar lo heredado y de no propagar el español; queda
  escrito aquí para que no se lea como un descuido ni se «arregle» en las dos direcciones.
- `deliveryFee` llega al código como `Prisma.Decimal`, no como `number`: hay exactamente una
  conversión, `toQabDeliveryFee`, y comparar dos `Decimal` con `===` sería siempre `false`. Está
  fijado en el contrato de interfaces y es la razón de que la conversión sea una función con
  nombre y no un `Number(...)` repetido.
- El vocabulario de los dos enums no está protegido por la base: una escritura por SQL directo
  puede dejar `checkoutMode` en cualquier cadena. Es el mismo trato que ya recibe `Tienda.tipo`, y
  la lectura de la pantalla lo tolera porque el schema de salida lo valida.

**Impacto en seguridad y escalabilidad:**
- Ninguna columna nueva participa en una clave, un índice ni un filtro: el aislamiento por
  `negocioId` del `PATCH` y del encolado no cambia, y no hay consulta nueva que pueda escaparse del
  tenant.
- La migración no reescribe `Tienda` —modelo central del POS, con filas en producción— así que no
  toma un lock largo ni depende del tamaño de la tabla.
- Reversión: quitar cinco columnas aditivas. Nada de lo existente cambia de forma, así que revertir
  el feature no obliga a reconstruir datos.
