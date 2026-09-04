# ADR 0037: Solo una respuesta `own` escribe `slugQab`, y su `resolvedSlug` se valida con `qabSlugSchema` antes de persistir

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-020

## Contexto

`Tienda.slugQab` es una columna que **acaba siendo un `href` en la pantalla del comerciante**
(`QAB_PUBLIC_STORE_URL_PREFIX + slugQab`) y el dato con el que se le dice «te asignaron esta
dirección». Su valor va a venir del cuerpo de una respuesta HTTP de un tercero.

Lo que el contrato v10 § ⑥ garantiza y lo que no:

- El espacio de slugs es **global y público**, compartido entre todos los negocios de QAB.
- `reason` tiene seis valores documentados, y cuadrecaja lo parsea como **string abierto**, no como
  enum, a propósito (ADR 0033): un séptimo valor no debe tumbar la pantalla.
- `reason: "own"` es el único caso en que el valor pertenece a la marca de `storeId`.
- `resolvedSlug` **no tiene formato acotado en el contrato**. En cuadrecaja lo recibe
  `tiendaOnlineSlugForecastSchema` como `z.string()` pelado, sin patrón ni cota: suficiente para
  **mostrar** un pronóstico, no para **persistir** un valor.
- `url` viene en la respuesta, y hoy no se usa para construir el enlace: `publicStoreUrl()` lo
  arma con el prefijo constante. Es lo que neutraliza un `javascript:` inyectado por el tercero.

`security-guardian` (F-020) señaló los tres riesgos de esta superficie: `resolvedSlug` es entrada
externa sin validar antes de persistirse (punto 3); un `reason` distinto de `"own"` cuyo
`resolvedSlug` se escribiera pondría **la URL en vivo del local de un competidor** en la pantalla
del comerciante, como si fuera la suya (punto 4); y cualquier campo nuevo derivado de la respuesta
tiene que llevar un código cerrado, nunca texto libre (punto 5).

Y las notas de F-020 añaden una trampa propia: § ⑥ es **un pronóstico, no una reserva**, así que un
pronóstico anterior al publish —el de `SlugPreviewField`, hecho sin `storeId`— no vale como fuente
del valor.

## Decisión

**La única respuesta que escribe la columna es `reason === "own"`, el valor escrito es el
`resolvedSlug` de ESA respuesta, y antes de escribirlo se valida con `qabSlugSchema`.**

Concretamente, en `decideQabSlugLearning` (pura) y en este orden, que es parte de la decisión:

1. `outcome.kind !== "ok"` → `upstream_error`. No se lee nada del cuerpo.
2. `forecast.reason !== QAB_SLUG_LEARNED_REASON` → `not_own`. **El guard va antes de cualquier
   lectura de `resolvedSlug`**, para que un reordenamiento futuro no pueda saltárselo.
   `QAB_SLUG_LEARNED_REASON` se declara como `"own" satisfies (typeof QAB_SLUG_REASONS)[number]`:
   el literal sale del vocabulario del contrato, no de una cadena suelta.
3. `qabSlugSchema.safeParse(forecast.resolvedSlug)` falla → `invalid_slug`. No se escribe, no se
   bloquea nada y **no se loguea el valor recibido**.
4. Solo entonces → `{ kind: "write", slugQab: parsed.data }`.

Se reutiliza **`qabSlugSchema`** (`src/schemas/qabStore.ts`: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1 a 80
caracteres), el mismo schema que valida el slug que escribe el comerciante, en vez de un patrón
nuevo. Dos motivos: es el mismo espacio de valores —el candidato que se manda y el asignado que
vuelve viven en el mismo registro de slugs del otro lado— y una cota propia sería una segunda
definición del formato de un slug en el repositorio.

Tres corolarios que quedan escritos para que nadie los regresione:

- **El valor nunca se deriva de otra cosa.** No de `Tienda.slug`, no del `candidate` que la
  respuesta devuelve, no del pronóstico pre-publish de `SlugPreviewField`, no del campo `url`.
  Una implementación que copiara `slug` a `slugQab` pasaría el caso del slug libre y fallaría el
  divergente: es el control que discrimina del criterio 1.
- **El `href` público se sigue construyendo como `QAB_PUBLIC_STORE_URL_PREFIX + slugQab`**, con la
  función `publicStoreUrl`, **nunca** desde el campo `url` de la respuesta. Es una decisión de F-005
  que este feature preserva a propósito, y ahora tiene una segunda razón: con `slugQab` validado
  contra el patrón, el `href` no puede ser un esquema de URL distinto de `https:`.
- **Nada de la respuesta se espeja.** El informe de la corrida y los logs de la fase llevan
  `negocioId`, `tiendaId` y un código de `QAB_SLUG_LEARN_OUTCOMES`; no llevan `reason`, ni `url`,
  ni el cuerpo, ni el slug. Es la disciplina de `logQabPermanentFailure` y de `logRouteError`
  aplicada a la pieza nueva.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Escribir `resolvedSlug` de cualquier respuesta 200 | El namespace de slugs es global: con `taken`, la columna guardaría el slug de otra marca y la pantalla ofrecería al comerciante el enlace en vivo del local de un competidor como si fuera el suyo. Confusión de identidad, y encima persistida. |
| Escribir cuando `storeKnown === true`, sin mirar `reason` | `storeKnown` responde «¿existe la tienda de ese `storeId`?», no «¿este valor es suyo?». Son dos preguntas, y colapsarlas es el defecto de E-013 en otra tabla. |
| Aceptar `resolvedSlug` tal como llega, porque `tiendaOnlineSlugForecastSchema` ya lo parsea | Ese schema valida **la forma** de la respuesta para mostrarla, no **el contenido** para persistirlo: `z.string()` acepta 4 KB de cualquier cosa, y ese valor acabaría concatenado en un `href`. `AGENTS.md` exige validar la entrada externa antes de persistir. |
| Un patrón propio, más laxo que `qabSlugSchema`, porque el contrato no acota `resolvedSlug` | Sería una segunda definición del formato de un slug, y la más permisiva de las dos ganaría en la práctica. Si algún día QAB asigna algo fuera del patrón, el fallo es **visible** (`invalid_slug` en el informe) y se corrige en un sitio. |
| Guardar el pronóstico que `SlugPreviewField` ya obtuvo antes de publicar | Es lo que las notas de F-020 prohíben con nombre y apellido: § ⑥ no reserva nada, así que entre el pronóstico y el publish otro pudo quedarse el valor. El único dato válido es el que responde **con el `storeId` ya conocido**. |
| Reflejar `reason` en el informe del cron para depurar | Es un string abierto que viene del cuerpo de un tercero y el informe agrega todos los negocios en un mismo sitio. El código cerrado dice lo mismo para operar y no arrastra texto ajeno. |

## Consecuencias

**A favor:**

- La columna solo puede contener un slug con forma de slug, de la marca dueña del `storeId`, leído
  después del publish. Cualquier otra cosa es un no-op de esa pasada.
- El guard `reason !== "own"` está antes de leer el valor, así que no hay orden de ejecución que lo
  esquive.
- La verificación del criterio 1 discrimina de verdad: el valor escrito no puede haber salido de
  `Tienda.slug`, porque `Tienda.slug` no entra en la decisión.

**En contra / coste asumido:**

- Si QAB asigna un slug que no satisface `qabSlugSchema`, cuadrecaja **no lo aprende nunca**
  (`invalid_slug` en cada pasada). Se prefirió fallar cerrado y visible antes que persistir texto
  de un tercero en una columna que se convierte en un enlace.
- Se descarta información de diagnóstico (`reason`, `url`) que habría sido cómoda al depurar. El
  código cerrado obliga a razonar con `not_own` en vez de con el `reason` exacto.

**Impacto en seguridad y escalabilidad:**

- Se reutiliza `fetchQabSlugAvailability` **sin duplicar su lógica**: conserva el
  `readBoundedBody` (cota de `QAB_HTTP_MAX_RESPONSE_BYTES`), el `AbortSignal.timeout`, el descarte
  de claves desconocidas (`reserving` incluido, ADR 0033) y la política de no loguear ni el token,
  ni la URL, ni el cuerpo. Un `fetch` inline «más simple» para el cron perdería las cuatro cosas.
- El token viaja solo en la cabecera `Authorization` de esa llamada y se obtiene únicamente por
  `loadQabTokens` (ADR 0013): la fase no añade un tercer lector de `qabToken` con un `select`
  propio.
- Coste constante por objetivo: una petición, una validación de una cadena de ≤ 80 caracteres, una
  escritura por clave primaria.
