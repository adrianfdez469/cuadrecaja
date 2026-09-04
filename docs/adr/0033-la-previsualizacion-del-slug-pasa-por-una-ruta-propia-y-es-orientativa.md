# ADR 0033: La previsualización del slug pasa por una ruta propia de cuadrecaja, y es orientativa: su fallo nunca bloquea el publish

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-005
**Se apoya en:** [ADR 0006](0006-qabtoken-invisible-por-defecto.md) ·
[ADR 0013](0013-lectura-del-qabtoken-con-select-explicito.md) ·
[ADR 0022](0022-ningun-estado-http-de-qab-se-espeja.md) ·
[ADR 0026](0026-dos-clientes-http-separados-hacia-qab.md) · contrato QAB v10, § ⑥

## Contexto

El criterio 3 pide que la pantalla del slug muestre el `resolvedSlug` y la `url` **reales** que
devuelve `GET /api/internal/slug-availability` de queandabuscando, no un cálculo local. Ese
endpoint se autentica con `Authorization: Bearer <Negocio.qabToken>`, y el `qabToken` es
server-only por el ADR 0006: el navegador no puede llevarlo, ni siquiera un rato.

Así que hace falta una ruta propia que lo tenga en el servidor. Lo que hay que decidir no es eso
—no hay alternativa—, sino tres cosas que implementador y tester resolverían distinto:

1. Qué hace la pantalla cuando esa consulta falla, y en particular con el `503`
   `SYNC_NOT_CONFIGURED` que el guard de `/api/internal/*` puede devolver.
2. Qué se hace con los seis valores de `reason` (`free`, `own`, `taken`, `reserved`, `retired`,
   `invalid`), y qué pasa si algún día hay un séptimo.
3. Qué se hace con un `tiendaId` que no es del negocio autenticado.

Y hay un matiz del propio contrato que condiciona todo: el endpoint **no reserva nada y no
garantiza nada**. Es un pronóstico de «qué slug quedaría si publicaras ahora». Entre la consulta y
el publish, otro negocio puede quedarse el valor. El `slug` del `payload` de `STORE`, además, es
**semilla de derivación al crear y nada más**: si está tomado, queandabuscando deriva el siguiente
libre en silencio y **el evento nunca falla por eso**.

## Decisión

**`GET /api/tienda-online/slug-availability` es una ruta del módulo como cualquier otra —mismo
gate, mismo `no-store`, mismo 500— que reenvía la consulta con el token del negocio de la sesión y
devuelve el pronóstico ya parseado.** El token se lee con `select` explícito
(ADR 0013) en el único lugar nuevo que lo nombra, `src/lib/qab/qabToken.ts`, y **no aparece en la
respuesta, ni en el cuerpo, ni en un log.**

Sobre eso, cuatro reglas.

**1. La previsualización es orientativa, y su fallo no bloquea nada.** El interruptor de publicar
sigue disponible aunque la consulta del slug haya fallado, esté cargando o no se haya hecho nunca.
No puede ser de otra forma sin mentir: el endpoint no reserva, y el `slug` del payload no puede
hacer fallar el evento. Bloquear el publish porque un pronóstico no responde inventa una
dependencia que el contrato no tiene, y deja al comerciante sin poder publicar por un fallo que no
afecta a la publicación.

**2. Ningún estado HTTP de queandabuscando se espeja** (ADR 0022). Todo fallo —`401`, `403`, el
`503 SYNC_NOT_CONFIGURED`, un timeout, un cuerpo que no parsea, `QAB_API_BASE_URL` sin definir o un
negocio sin token— sale como **`502`** con la forma que F-003 ya estableció:

```jsonc
{ "error": "QAB_SLUG_UPSTREAM", "qabError": "SYNC_NOT_CONFIGURED", "retryable": true }
```

`qabError` es uno de un enum cerrado. **Nada del cuerpo de queandabuscando llega al navegador**: un
enum cerrado no puede filtrar lo que no está en él. El `503` en concreto se traduce a
`qabError: "SYNC_NOT_CONFIGURED"` con `retryable: true`, y la pantalla ofrece reintentar — sin
esconder el interruptor de publicar, por la regla 1.

**3. `reason` se parsea como string abierto, no como enum.** Los seis valores del contrato viven en
`QAB_SLUG_REASONS` y la pantalla los mapea a copy en español, pero un séptimo valor **no puede
tirar la pantalla**: cae en una frase genérica y `resolvedSlug` y `url` se muestran igual. Es la
misma razón por la que `results[].status` de la respuesta del outbox es un `z.string()` y no un
enum. La decisión del comerciante se toma con `available`, `resolvedSlug` y `url`; `reason` solo
elige la frase que lo explica.

**4. Un `tiendaId` que no es del negocio de la sesión responde `404 TIENDA_NOT_FOUND`**, y nunca se
reenvía a queandabuscando. El contrato permite mandarlo —él lo trataría como si no se hubiera
enviado, con `storeKnown: false`— pero reenviar un identificador ajeno para que lo resuelva otro
sistema es delegar el control de tenencia. La comprobación es positiva y greppable
(`findFirst({ where: { id, negocioId }, select: { id: true } })`), y el `404` es indistinguible del
de un `tiendaId` inexistente: no sirve para averiguar si un local existe en otro negocio.

**El campo `reserving` no se reexpone.** El contrato dice que es SIEMPRE `false`; reenviarlo invita
a construir un flujo de reserva sobre un campo que no reserva nada.

**Un cliente HTTP nuevo, `src/lib/qab/qabSlugClient.ts.`** El sujeto de autenticación es el mismo
que el del cliente de catálogo (el token del negocio), pero el vocabulario de fallo es otro: aquel
escribe códigos en `OutboxEvento.ultimoError` para un cron, este responde a una petición de usuario
que está esperando. Mezclarlos obligaría a una de las dos mitades a hablar el idioma de la otra.
Comparte `readBoundedBody`, `resolveQabBaseUrl` y el tope de tiempo.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Llamar a queandabuscando desde el navegador | Exige el `qabToken` en el cliente. Prohibido por el ADR 0006, y no hay forma de acotarlo: quien tiene el token del negocio puede escribir todo su catálogo |
| Calcular el slug en cuadrecaja (normalizar y contar) | El criterio 3 pide el valor real. El espacio de slugs es global entre negocios y tiene palabras reservadas y slugs retirados que no vuelven al pool: cualquier cálculo local acierta hasta que no |
| Espejar el estado de queandabuscando (`401`, `503`) | ADR 0022. Un `401` dispara `signOut()` y echa al usuario de la aplicación (E-007); un `403` pierde el cuerpo por el camino (E-009) |
| Bloquear el publish si el slug no está confirmado disponible | El endpoint no reserva y el `slug` del payload nunca hace fallar el evento: sería una precondición inventada que solo puede impedir publicar |
| `reason` como `z.enum` de seis valores | Un séptimo valor del otro lado rompería la pantalla entera para no ganar nada: el flujo se decide con `available` y `resolvedSlug` |
| Reenviar el `tiendaId` tal cual y confiar en el `storeKnown: false` | Funciona, y deja el control de tenencia en el sistema de al lado. Aquí la tenencia se comprueba aquí |
| Guardar el `resolvedSlug` en `Tienda.slugQab` al previsualizar | Sería registrar como asignado un valor que nadie reservó. `slugQab` es lo que queandabuscando asignó de verdad, y este feature no lee hacia atrás |

## Consecuencias

**A favor:**
- El `qabToken` no sale del servidor, y la ruta que lo usa lo lee con `select` explícito en un
  único archivo nuevo, auditable con un `grep`.
- La pantalla del slug puede fallar entera sin impedir que el comerciante publique, que es el
  objetivo del feature.
- Un cambio en el vocabulario de queandabuscando (un `reason` nuevo) degrada una frase, no una
  pantalla.

**En contra / coste asumido:**
- Un salto de red más por cada previsualización, y una ruta más que mantener.
- Quien depure con `curl` verá un `502` donde arriba hubo un `503`. El cuerpo lo dice; es el precio
  de no mentir sobre quién falló (ADR 0022).
- El pronóstico puede quedar obsoleto entre la consulta y el publish. Es una propiedad del
  endpoint, no de esta decisión, y la pantalla tiene que decirlo con palabras.

**Impacto en seguridad y escalabilidad:**
- Ni el token ni el cuerpo de queandabuscando llegan al navegador: solo un código de un enum
  cerrado.
- El `tiendaId` se valida contra `negocioId` antes de salir de cuadrecaja; el `404` no distingue
  «no existe» de «no es tuyo».
- La ruta es `no-store` y con tope de tiempo (`QAB_HTTP_TIMEOUT_MS`) y de tamaño de respuesta
  (`readBoundedBody`): un tercero lento o verboso no puede colgar ni inflar la función.
- Es una lectura sin escritura. Reversión inmediata: se borra la ruta y la pantalla pierde la
  previsualización, no la capacidad de publicar.
