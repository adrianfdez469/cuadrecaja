# ADR 0032: El `payload` de `STORE` se construye entero desde la fila ya persistida, y las dos semánticas de omisión se hacen imposibles de confundir

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-005
**Se apoya en:** contrato QAB v10, § ① «`payload` de `STORE`» y su tabla de propiedad de campos ·
[ADR 0010](0010-una-transaccion-por-corrida-de-drenaje.md)

## Contexto

En el mismo `payload` de `STORE` conviven **dos semánticas de omisión opuestas**, y el contrato
avisa de que confundirlas borra datos reales del comerciante:

- Los **nueve campos de contacto** (`description`, `address`, `city`, `province`, `latitude`,
  `longitude`, `phone`, `whatsapp`, `email`) se escriben del otro lado con `payload.x ?? null`.
  **Omitir uno BORRA la columna**, exactamente igual que enviar `null`. No existe «no tocar».
- **`openingHours`** se comporta al revés: **ausente o `null` deja la columna intacta**.

El reflejo natural de cualquiera que implemente un `PATCH` —mandar solo lo que cambió— borra los
ocho campos que el comerciante no tocó. Y el reflejo contrario —mandar siempre todo, incluido
`openingHours: null`— es correcto por casualidad, porque `null` ahí no borra; pero deja de serlo
en cuanto alguien lo copie a un campo del primer grupo.

Hay dos problemas más, pequeños y con dientes:

- **`Tienda` no tiene columna `updatedAt`.** El `payload` sí lleva un `updatedAt` que
  queandabuscando usa como guarda anti-rancio: un evento con `updatedAt` menor o igual al guardado
  no escribe nada.
- **`timezone` no viaja en ningún sitio.** Dentro de `openingHours` es una clave desconocida y
  rechaza el evento entero; en la raíz se descarta sin error. Es del panel de queandabuscando y el
  POS no la escribe. El criterio 11 pide comprobar que no aparece en ninguno de los dos niveles.

## Decisión

**Una única función pura, `buildQabStorePayload(input)`, construye el `payload` completo a partir
de la fila de `Tienda` ya escrita, nunca del body de la petición.** Vive en
`src/lib/qab/qabStorePayload.ts`, se llama dentro de la misma transacción que persistió el cambio,
y su salida se valida con `qabStorePayloadSchema` (`.strict()`) antes de encolarse.

Cuatro reglas, y cada una convierte un error posible en un error que no compila o que revienta el
test:

1. **Los nueve campos de contacto son obligatorios en el schema de salida**, con tipo
   `T | null`. No `.optional()`. Un `payload` al que le falte uno **no parsea**, así que la
   semántica de borrado no depende de que nadie se acuerde de nada: depende del tipo.
2. **`openingHours` se omite por clave** —no viaja como `null`— cuando `Tienda.horarios` está
   vacío. El criterio 10 se verifica buscando la clave en el `payload` guardado, y `null` la
   dejaría presente. Cuando `Tienda.horarios` tiene contenido, se valida con el recolector del
   [ADR 0031](0031-validador-propio-del-calendario-con-codigos-de-infraccion.md) y, si no es
   válido, **la función lanza**: al estar dentro de la transacción, eso revierte la escritura. Un
   calendario inválido no llega jamás a `OutboxEvento`, ni por la puerta de atrás.
3. **`qabStorePayloadSchema` es `.strict()`**, y no declara `timezone`. Una clave `timezone` en la
   raíz no es un descuido que se descarte del otro lado: aquí no parsea. El criterio 11 pasa a ser
   estructuralmente imposible de romper, en los dos niveles (dentro de `openingHours` lo impide
   `UNKNOWN_KEY` del ADR 0031).
4. **El `PATCH` del módulo es un reemplazo completo del bloque de tienda online**, no un parcial.
   Todas las claves del bloque son obligatorias en el body, `null` incluido. Es la misma regla de
   omisión de queandabuscando aplicada un escalón antes: lo que no mandas, se borra — en
   cuadrecaja y, en el siguiente evento, allí. Una sola regla en las dos fronteras en vez de una
   traducción entre dos.

Y las tres decisiones menores, escritas para que nadie las tenga que adivinar:

- **`updatedAt` del `payload` es el instante de la mutación**, tomado dentro de la transacción, y
  es **el mismo valor** que se escribe en `OutboxEvento.ocurridoAt`. No se añade una columna
  `updatedAt` a `Tienda`: es un modelo central del POS y F-005 no necesita migración.
- **`baseCurrency` no se envía.** El ejemplo del contrato lo incluye («por defecto CUP si se
  omite») pero la tabla de propiedad de campos de la v9 no lo lista entre las 31 columnas de
  `Store`. Ante esa contradicción, omitirlo es lo único que no puede escribir un valor equivocado;
  la moneda es de F-006, que decidirá con el contrato en la mano.
- **`operation` es `CREATE` la primera vez que se emite un evento `STORE` para ese local y
  `UPDATE` después**, resuelto con una consulta al índice `@@index([entidad, entidadId])` de
  `OutboxEvento`. queandabuscando localiza la fila por `storeId` en los dos casos, así que
  acertar o no es inocuo; se decide así para que el valor signifique algo y no sea una constante
  disfrazada.
- **Todo `PATCH` que se aplica emite evento**, aunque el comerciante no haya cambiado nada
  relevante. Es lo que hace verdadero el criterio 5 sin ninguna lógica de diffing: el evento
  repite el `publishToStore` que ya tenía y queandabuscando, que solo reescribe `status` cuando
  ese valor difiere, no reabre nada.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Construir el `payload` desde el body del `PATCH` | El body puede no traer lo que la fila tiene (un campo que la pantalla no muestre todavía), y cada omisión borra una columna del comerciante. La fila persistida es la única fuente que no puede mentir sobre el estado actual |
| Body parcial (`.partial()`) y mezclar con la fila | Funciona, y es exactamente la construcción que invita a mandar «solo lo que cambió» al payload en el siguiente refactor. La regla de omisión ya es contraintuitiva una vez; tenerla en dos formas distintas en dos capas la hace indefendible |
| Los nueve campos como `.optional().nullable()` | Compila, y deja que un `payload` incompleto llegue al cable. El tipo es la única defensa que no se olvida |
| Enviar `openingHours: null` cuando no hay horario | Deja la columna intacta igual, pero el criterio 10 se verifica por presencia de la clave, y acostumbra a tratar `null` y ausente como sinónimos — cosa que en los nueve campos de contacto es falsa |
| Añadir `updatedAt` a `Tienda` con una migración | `Tienda` es un modelo central del POS y el spec dice explícitamente que este feature no necesita migración. El instante de la mutación cumple la guarda anti-rancio con un coste conocido (abajo) |
| Enviar `baseCurrency: "CUP"` | Escribe un valor de negocio que este feature no gestiona ni muestra, en una columna que la tabla de propiedad ni siquiera lista. Omitir no puede equivocarse |
| `operation: "UPDATE"` siempre | Es lo que hace hoy queandabuscando de todos modos, pero convierte un campo del cable en una constante y pierde la única señal de «esta tienda se anuncia por primera vez» que tenemos sin leer hacia atrás |

## Consecuencias

**A favor:**
- Los criterios 9, 10 y 11 dejan de depender de la disciplina de quien escriba el próximo cambio:
  los sostiene el schema. Un `payload` mal construido no parsea y la transacción revierte.
- El borrado accidental de datos de contacto —el fallo más caro de este feature, porque es
  silencioso y del lado del comerciante— requiere saltarse un tipo obligatorio.
- La construcción es pura y sin E/S: el `dev-tester` la ejercita entera con objetos literales,
  sin base ni red.

**En contra / coste asumido:**
- **Dos mutaciones del mismo local en el mismo milisegundo hacen que la segunda se descarte** por
  la guarda anti-rancio de queandabuscando, porque las dos llevarían el mismo `updatedAt`. Es
  edición humana a través de un formulario: el riesgo es teórico, pero es deuda asumida a
  propósito y se paga con una columna `updatedAt` en `Tienda` el día que moleste.
- Un reemplazo completo del bloque hace que dos pestañas abiertas se pisen entera la última
  edición, no solo el campo tocado. A cambio, lo que se pisa es exactamente lo que la pantalla
  mostraba: no hay borrados invisibles.
- Cada guardado, cambie algo o no, escribe una fila de outbox. Son ediciones manuales de
  configuración: unidades al día por negocio, no un flujo.

**Impacto en seguridad y escalabilidad:**
- El `payload` se construye desde una fila leída **con el filtro de `negocioId` en el `where`**, y
  `businessId` sale de ese mismo `negocioId`, nunca del body. Un `payload` de `STORE` con el
  `businessId` de otro negocio no es algo que cuadrecaja pueda producir.
- La consulta que decide `CREATE`/`UPDATE` va contra `@@index([entidad, entidadId])` y devuelve
  como mucho una fila (`select: { id: true }`, `take: 1`). No crece con el histórico.
- Reversión: es una función pura y un schema. Sin migración, sin dato persistido nuevo.
