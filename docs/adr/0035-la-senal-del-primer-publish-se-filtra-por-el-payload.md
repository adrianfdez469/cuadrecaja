# ADR 0035: La señal del primer publish se filtra por el `payload` del evento, no por la existencia del evento

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-005
**Corrige:** el contrato de interfaces de [F-005](../../.agents/specs/F-005.md), §4 y §5.1
**Se apoya en:** [ADR 0032](0032-el-payload-de-store-se-construye-entero-desde-la-fila-persistida.md) ·
contrato QAB v10, § ① «`payload` de `STORE`»

## Contexto

El criterio de aceptación 6 de F-005 exige que **antes del primer publish** de un local la UI
pregunte si abre su propia tienda o se suma a una existente. La pregunta se hace **una sola vez por
local**: una vez contestada, `storefrontId` no se vuelve a mover, y volver a preguntar permitiría
emitir un segundo evento con una intención de marca distinta a la que ya salió hacia
queandabuscando.

La primera versión de este contrato definió la señal que gobierna ese diálogo como **«no se ha
emitido nunca un evento `STORE` para este local»**:

```ts
const previous = await tx.outboxEvento.findFirst({
  where: { negocioId, entidad: "STORE", entidadId: tiendaId },
  select: { id: true },
});
const firstPublishPending = previous === null;
```

Esa definición choca de frente con otra decisión del mismo contrato, correcta y que no se toca:
**todo `PATCH` que se aplica emite un evento**, cambie algo o no (es lo que hace verdadero el
criterio 5 sin lógica de *diffing*). Las dos juntas rompen el criterio 6 en el recorrido normal, no
en un borde:

1. El comerciante abre un local nunca publicado y rellena sus datos de contacto.
2. Guarda. Se emite un evento `STORE` con `publishToStore: false`.
3. La señal pasa a `false`.
4. Enciende el interruptor de publicar y **el diálogo de marca no se abre**, porque la señal dice
   que la pregunta ya se hizo. Nunca se hizo.

Todo comerciante que rellene los datos antes de encender el interruptor —el orden natural del
formulario— pierde la pregunta para siempre.

Y hay una segunda confusión debajo: de esa misma variable se derivaba
`operacion: "CREATE" | "UPDATE"`. Son **dos preguntas distintas** colapsadas en una:

- `operacion` pregunta **«¿existe ya la fila del otro lado?»**. Del lado de queandabuscando la fila
  del `store` se escribe con el primer evento que llega, publique o no.
- El diálogo de marca pregunta **«¿ya se publicó alguna vez?»**.

Restricción de alcance: el spec de F-005 dice explícitamente que este feature **no necesita
migración**, y añadir una columna a `Tienda` (`primerPublishAt`, o similar) es un cambio de alcance
que además introduce un segundo lugar donde la verdad puede desincronizarse del outbox.

## Decisión

**La señal es «existe al menos un evento `STORE` de este local cuyo `payload.publishToStore` es
`true`», y se obtiene filtrando el `Json` del outbox con `payload: { path: ["publishToStore"],
equals: true }`.** Sin columna nueva y sin migración.

Tres consecuencias directas:

1. **La lectura del outbox se divide en dos predicados con nombre propio**, cada uno respondiendo
   la pregunta que le corresponde:
   - `hasEverPublishedToStore` — con el filtro por `payload`. Gobierna el diálogo de marca.
   - `hasAnyStoreEvent` — sin filtro, la consulta original. Gobierna `operacion`.

   El segundo solo se ejecuta cuando el primero devuelve `false`: si ya hubo un publish, la fila
   existe del otro lado por transitividad y `operacion` es `"UPDATE"` sin preguntar nada más.

2. **El campo expuesto sigue llamándose `firstPublishPending`**, y su documentación se corrige:
   *«no existe ningún evento `STORE` de este local con `publishToStore: true`»*. Con la definición
   corregida el identificador dice la verdad —«el primer publish sigue pendiente»—; lo que mentía
   era el comentario que lo definía como «no se ha emitido ningún evento». El contrato de diseño lo
   consume en quince sitios y sus criterios 14, 39 y 45 están escritos contra esa polaridad:
   invertirla a mitad de la implementación es introducir un defecto a cambio de nada.

3. **La respuesta del `PATCH` deja de devolver `false` fijo.** El evento que acaba de emitirse
   cuenta como primer publish **solo si llevaba `publishToStore: true`**:
   `firstPublishPending = !(everPublishedBefore || updated.publicarEnTienda)`. Un guardado con el
   interruptor apagado devuelve `true` y el diálogo sigue en pie.

El filtro está **verificado ejecutándolo** contra la base de desarrollo, sobre un local con diez
eventos `STORE` reales: `count` total 10, con `equals: true` 5, con `equals: false` 5. El predicado
discrimina, y `groupBy(["entidadId"])` con ese mismo `where` también funciona, que es lo que
necesita el `GET` para resolver los N locales en una consulta.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Columna nueva en `Tienda` (`primerPublishAt`) | Exige migración, que el spec descarta, y crea una segunda fuente de verdad que puede desincronizarse del outbox. El outbox ya contiene el dato: derivarlo no puede quedar desfasado |
| Emitir solo cuando algo cambia (*diffing*), para que la señal original valiera | Rompe la decisión que hace verdadero el criterio 5 sin lógica, y el *diffing* de un bloque de dieciséis campos con dos semánticas de omisión opuestas (ADR 0032) es exactamente donde se pierden datos |
| No emitir evento cuando `publicarEnTienda` es `false` y nunca se publicó | El comerciante perdería sus datos de contacto del lado de queandabuscando hasta el primer publish, y el criterio 5 dejaría de ser cierto para el caso «guardo sin publicar» |
| Usar `Tienda.publicarEnTienda` como señal | Es el estado **actual**, no el histórico: un local despublicado volvería a recibir la pregunta de marca y podría cambiar su `storefrontId` |
| Usar `Tienda.slugQab != null` | Contesta a otra pregunta —«¿queandabuscando ya acusó recibo?»— y depende de que el drenaje haya corrido. Con el outbox pendiente o fallido preguntaría dos veces. Ya descartado en el contrato de diseño §273 |
| Contar `publishToStore: true` con `$queryRaw` sobre `jsonb` | Innecesario: el filtro nativo de Prisma resuelve lo mismo y no esquiva el tipado del cliente |
| Renombrar el campo a `everPublished` (polaridad invertida) | La corrección es de definición, no de nombre: con la definición arreglada `firstPublishPending` es literal. El renombrado obliga a reescribir quince referencias del contrato de diseño —que el arquitecto no puede editar— y a invertir la polaridad en la UI que se está escribiendo ahora mismo |

## Consecuencias

**A favor:**

- El criterio 6 se cumple en el recorrido normal: rellenar los datos antes de encender el
  interruptor ya no consume la pregunta de marca.
- La pregunta sigue haciéndose **una sola vez por local**: en cuanto sale un evento con
  `publishToStore: true`, la señal se apaga para siempre, incluso si ese evento falló en
  queandabuscando. Es deliberado: el evento sigue en el outbox y se reintentará; volver a preguntar
  produciría un segundo evento con otra intención de marca y el drenaje enviaría los dos.
- `operacion` y el diálogo de marca dejan de compartir una variable que respondía a una sola de las
  dos preguntas.
- Ninguna migración, ningún cambio de alcance, y ninguna columna que pueda desincronizarse del
  outbox.

**En contra / coste asumido:**

- Un predicado sobre `Json` no está indexado: el índice `@@index([entidad, entidadId])` acota las
  filas candidatas y el filtro se aplica encima. Aceptable porque las filas por local son el número
  de `PATCH` que ese local ha recibido —decenas—, no el histórico del negocio.
- La señal depende de la forma del `payload`. Si algún día la clave `publishToStore` cambia de
  nombre en el contrato de QAB, esta consulta deja de encontrar nada **en silencio** y el diálogo
  reaparece. Mitigación: la clave se nombra desde el tipo del `payload`, no como literal suelta, y
  el criterio 6 se verifica ejecutándolo.
- Dos consultas al outbox en el peor caso del `PATCH` (solo cuando el local nunca se publicó).

**Impacto en seguridad y escalabilidad:**

- Las dos consultas llevan `negocioId` en el `where`, además de `entidad` y `entidadId`. La
  tenencia no se deduce de que `entidadId` sea un UUID.
- El `GET` mantiene su coste: los locales, sus estados de sincronización y **una** consulta de
  publicaciones para los N locales, agregada en SQL con `groupBy(["entidadId"])`, que devuelve como
  máximo una fila por local por larga que sea la historia. Sigue sin haber `1 + N`.
- No se introduce ningún tope de filas en esa consulta **a propósito**: un tope con `take` podría
  dejar fuera un publish antiguo y devolver «nunca publicado» para un local ya publicado —un tope
  que produce una respuesta incorrecta es peor que la consulta sin tope. La agregación en SQL hace
  el tope innecesario.
