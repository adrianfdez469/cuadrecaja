# ADR ADRIAN-0152: «Omitir no es apagar» se resuelve comparando la fila antes y después dentro de la transacción, y el delta decide qué claves viajan, nunca su valor

**Estado:** aceptado
**Fecha:** 2026-09-12
**Feature:** F-016
**Acota, sin reemplazarla, a [ADR 0032](0032-el-payload-de-store-se-construye-entero-desde-la-fila-persistida.md)**
**Se apoya en:** contrato QAB v13.5, § ① «`payload` de `STORE`» («dos semánticas de omisión conviven
en este mismo `payload`») · ADR 0028 (d) de queandabuscando
(`$QAB_DOCS_PATH/adr/0028-configuracion-de-compra-del-pos.md`) ·
[ADRIAN-0151](ADRIAN-0151-las-cinco-columnas-de-compra-se-llaman-como-el-cable.md)

## Contexto

En el `payload` de `STORE` conviven dos semánticas de omisión opuestas, y las cinco columnas de
este feature están del lado contrario al de los nueve campos de contacto:

- **Nueve campos de contacto:** se escriben del otro lado con `payload.x ?? null`. Omitir uno
  **borra** la columna. Por eso ADR 0032 los declaró obligatorios en el schema de salida y construyó
  el `payload` **entero** desde la fila persistida, y por eso su tabla de alternativas descarta
  expresamente «mandar solo lo que cambió».
- **Las cinco de configuración de compra:** ausente **deja la columna intacta**. Un evento rutinario
  —corregir un teléfono— que las mandara con su valor actual sería inofensivo hoy, pero un evento
  que las mandara con sus **defaults** apagaría el domicilio de cualquier tienda configurada a mano
  antes de este feature. Es el motivo entero del feature y el criterio de aceptación 4.

Aquí aparece el problema que ADR 0032 no podía tener: `buildQabStorePayload` recibe **la fila
persistida**, y una fila no sabe qué cambió en la operación que la escribió. Con ese único
argumento, las cinco claves solo pueden viajar *siempre* o *nunca*, y las dos cosas están mal:
siempre incumple el criterio 4, nunca incumple el 3.

Hace falta, entonces, una fuente para «qué cambió en esta operación», y hay que decidir de dónde
sale, quién la calcula y en qué capa vive. Es además la frontera exacta donde `implementer` y
`dev-tester` —que trabajan en paralelo y sin verse— pueden desalinearse: una firma ambigua aquí
produce un test que falla por una razón falsa.

Un candidato obvio —comparar el **body** del `PATCH` con la fila— arrastra justo lo que ADR 0032
cerró: el body es la fuente que *puede* mentir sobre el estado, y volver a mirarlo para decidir
contenido del `payload` reabre la puerta que aquella decisión clausuró.

## Decisión

**(a) El delta se calcula comparando dos estados *persistidos* de la misma fila:** la proyección
leída al empezar la transacción (antes) y la que devuelve el `update` (después). El body del `PATCH`
no participa. Así el invariante de ADR 0032 sigue en pie con todas sus letras: **todo lo que entra
en el `payload` sale de la fila escrita**, nunca de la petición.

**(b) El delta decide qué claves viajan; la fila persistida sigue decidiendo su valor.** Son dos
preguntas y se responden en dos sitios: `collectQabStorePurchaseConfigChanges(before, after)`
devuelve **solo las claves que cambiaron, con el valor de `after`**, y `buildQabStorePayload` las
esparce tal cual sobre el `payload` que ya construía. Una clave que no cambió no aparece en el
objeto —no aparece como `undefined`—, que es lo que el criterio 4 verifica buscando la clave en el
`payload` guardado.

**(c) Delta vacío es el caso normal, no un error.** Un `PATCH` que solo corrige el teléfono produce
un delta sin ninguna clave, el `payload` resultante es exactamente el que F-005 emite hoy, y el
evento se encola igual. No se añade lógica de «no emitir si nada cambió»: eso es otra decisión, ya
tomada por ADR 0032 («todo `PATCH` que se aplica emite evento»), y este feature no la toca.

**(d) La comparación se hace sobre la forma del cable, no sobre la fila cruda.**
`toQabStorePurchaseConfig(row)` convierte primero la proyección de Prisma en el objeto de cinco
valores del cable —`Prisma.Decimal | null` a `number | null` incluido— y el comparador trabaja sobre
eso, con `===` campo a campo. Dos `Prisma.Decimal` comparados con `===` son **siempre** distintos, y
ese sería un delta que incluye `deliveryFee` en cada guardado: exactamente el fallo que este ADR
existe para impedir, disfrazado de código correcto.

**(e) Las tres funciones son puras y viven en `src/lib/qab/`**, fuera de la transacción que las
llama. La suite las ejercita con objetos literales, sin base ni red, que es la única forma de
verificar el criterio 4 antes de QA: no hay `@testing-library/react` y el resto del camino pasa por
Prisma.

**(f) El invariante de contradicción se comprueba también aquí, como red.**
`buildQabStorePayload` lanza `QabStorePurchaseConfigError` si el `payload` que va a emitir lleva a
la vez `deliveryEnabled: true`, `deliveryFeeMode: "FLAT_RATE"` y `deliveryFee: null` —la mitad del
invariante que se ve dentro de un solo `payload`—. Al estar dentro de la transacción, ese lanzamiento
revierte la escritura, igual que hace F-005 con un calendario inválido. Es inalcanzable desde la
pantalla, porque el schema del body ya lo rechaza antes; existe para que no lo alcance tampoco un
llamador futuro.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Mandar las cinco siempre, con su valor actual | Incumple el criterio 4 tal cual está redactado («el `payload` de ese evento **no** contiene ninguna de las cinco claves»). Y deja el sistema a un descuido de distancia del desastre: el día que alguien construya el `payload` desde un objeto por defecto en vez de desde la fila, apaga el domicilio de todas las tiendas configuradas a mano |
| No mandarlas nunca salvo desde una acción dedicada («guardar configuración de compra») | Parte el `PATCH` de reemplazo completo de ADR 0032 en dos puertas con dos semánticas. Y la pantalla es un único formulario con una única barra de guardado: dos puertas serían una ficción de la capa de datos |
| Comparar el **body** del `PATCH` con la fila leída | Vuelve a hacer del body una fuente de contenido del `payload`, que es lo que ADR 0032 cerró. Hoy son equivalentes porque el `update` escribe el body verbatim; el día que deje de serlo, el delta describiría una escritura que no ocurrió |
| Guardar en `Tienda` una instantánea de «lo último emitido» y comparar contra ella | Una columna más que mantener, que se desincroniza en cuanto un evento falla o se purga, y que inventa un estado que el outbox ya contiene |
| Deducir el delta leyendo el último `OutboxEvento` de esa tienda | Consulta extra dentro de la transacción, y una respuesta que depende del purgado (F-019) y de si el evento llegó a aplicarse. El histórico no es el estado |
| Que el delta sea una lista de claves y el constructor lea los valores de la fila | Dos recorridos de las mismas cinco claves y dos sitios donde equivocarse de campo. Con clave y valor juntos, el constructor solo esparce |
| Marcar las claves no cambiadas como `undefined` en vez de omitirlas | `JSON.stringify` las quita, así que *parece* equivalente, pero el objeto intermedio sí las tiene y cualquier comprobación por `in` o por `Object.keys` —la del criterio 4, sin ir más lejos— da la respuesta contraria |
| Comparar `before`/`after` con una igualdad profunda genérica | Cinco campos escalares no necesitan una librería, y una igualdad genérica sobre un `Prisma.Decimal` compara sus campos internos: acierta por casualidad hasta que cambie la representación |

## Consecuencias

**A favor:**
- El criterio 4 se verifica sobre una función pura con dos objetos literales, y el criterio 3 con la
  misma función y un campo distinto. Ninguno depende de que alguien recuerde la regla.
- ADR 0032 sigue siendo cierto sin excepciones: el `payload` se construye entero desde filas
  persistidas. Lo único que este ADR añade es **quién decide la presencia** de cinco claves cuya
  semántica de omisión es la contraria.
- La conversión `Decimal → number` tiene un solo sitio, y es el mismo que usa el comparador y el que
  alimenta la pantalla: no hay dos versiones del importe circulando.

**En contra / coste asumido:**
- **Un evento que falla permanentemente deja el delta consumido.** Si el evento que llevaba
  `deliveryEnabled` es rechazado y luego agota sus reintentos, un guardado posterior que no vuelva a
  cambiar ese campo **no lo reenviará**, y la tienda quedará configurada en cuadrecaja y no en
  queandabuscando. No se añade reconciliación en este feature: el estado de sincronización de la
  pantalla (F-005, `StoreSyncStateRow`) es donde eso se ve, y `STORE_DELIVERY_CONFIG_INCONSISTENT`
  llega hasta ahí con su código. Es deuda consciente y es el motivo por el que la pantalla enseña el
  estado en vez de esconderlo.
- Una escritura directa por SQL sobre `Tienda` no produce delta —nadie la compara con nada— y no se
  emite. Es la misma propiedad que ya tiene cualquier columna del bloque QAB.
- Dos lecturas de la misma fila dentro de la transacción (la de antes y la que devuelve el `update`)
  en vez de una. Ya existían las dos: F-005 lee `existing` para comprobar el tipo de local y
  `updated` para construir el `payload`.

**Impacto en seguridad y escalabilidad:**
- El delta no añade ninguna consulta: compara dos proyecciones que la transacción ya tenía en la
  mano, las dos leídas con `negocioId` en el `where`. El coste por guardado es constante y no crece
  con el histórico de eventos.
- `buildQabStorePayload` sigue sin recibir nada del body, así que el `payload` no puede llevar un
  valor que el tenant del `PATCH` no haya escrito.
- Reversión: son tres funciones puras y cinco claves opcionales en un schema. Revertir el feature
  deja de emitir las claves y el otro lado, por la propia regla de omisión, se queda exactamente
  como estaba.
