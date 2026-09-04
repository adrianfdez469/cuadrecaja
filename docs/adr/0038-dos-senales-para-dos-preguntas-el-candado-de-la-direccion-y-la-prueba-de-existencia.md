# ADR 0038: Dos señales para dos preguntas — `firstPublishPending` cierra el candado de la dirección, `slugQab` prueba la existencia

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-020

## Contexto

Este ADR resuelve la primera «Pregunta abierta» de `.agents/specs/F-020.md`, que venía del criterio
de diseño 21 de `.agents/designs/F-005.md`: durante la ventana en la que un local **ya está
publicado** pero `slugQab` sigue `null`, ¿el campo de dirección sigue editable o se bloquea?

Lo que ya estaba decidido y no se toca:

- `slug` es **semilla de derivación solo al CREAR** la tienda del otro lado. Después del primer
  publish, escribir ese campo no mueve nada allá.
- El diseño de F-005 lo dice con estas palabras: «un campo que se puede escribir y no hace nada es
  peor que uno bloqueado con su razón», y midió el coste de esperar: hasta F-020, el comerciante
  puede reescribir la dirección después de publicar y su cambio se descarta en silencio.
- [ADR 0035](0035-la-senal-del-primer-publish-se-filtra-por-el-payload.md) ya sustituyó la señal de
  «¿se publicó?» por `firstPublishPending`, definida como **«ningún evento `STORE` de este local
  lleva `payload.publishToStore: true`»**.
- [E-013](../../.agents/errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md) dejó
  una regla explícita: **«no uses una sola señal para dos preguntas distintas»**. `slugQab`
  respondía a la vez «¿ya se publicó?» y «¿cuál es la dirección?»; la primera es un booleano y la
  segunda un valor, y al colapsarlas, arreglar una rompía la otra.
- [E-014](../../.agents/errors/E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) dejó otra:
  una señal derivada **se define en un sitio**, porque una definición parafraseada en ocho sitios
  hace que la siguiente corrección deje alguna atrás.

Y una tensión real, que el propio diseño de F-005 anotó: `firstPublishPending === false` significa
que **se emitió** un `STORE` con `publishToStore: true`, no que QAB lo haya **aplicado**. Si ese
evento quedó `FAILED` o `BLOCKED`, la fila `Store` puede no existir todavía del otro lado.

## Decisión

**Dos señales, con nombre propio, definidas una sola vez, para dos preguntas que no son la misma.**

```ts
// src/components/tiendaOnline/publicationPresentation.ts
isStoreAddressCommitted(local) === !local.firstPublishPending
isKnownInOnlineStore(local)    === local.slugQab !== null
```

**(a) «¿Se puede seguir cambiando la dirección?» → `isStoreAddressCommitted`, sobre
`firstPublishPending`.** Apenas un evento `STORE` de ese local llevó `publishToStore: true`, el
campo de slug se bloquea (`disabled`) y muestra su razón —«La dirección se fija al publicar por
primera vez y no se puede cambiar desde Cuadre de Caja.»— sin esperar a conocer el valor asignado.
Es la indicación del humano y coincide con el argumento del diseño de F-005: en esa ventana el
campo no hace nada, y dejarlo editable invita a escribir algo que se descarta en silencio.

**(b) «¿Existe este local del otro lado, con datos que se pueden borrar?» →
`isKnownInOnlineStore`, sobre `slugQab`.** Esta sigue siendo la única **prueba** de existencia que
cuadrecaja tiene, y desde F-020 lo es de verdad: la columna se escribe solo cuando QAB responde
`reason: "own"` para ese `storeId` (ADR 0037), es decir, cuando QAB mismo confirma que la tienda
existe y esa es su dirección. Gobierna la URL pública, el aviso «pediste X y te asignaron Y», la
nota del panel y los dos copys del campo de contacto vacío.

**La tabla completa, que es el contrato de gating de la pantalla:**

| Qué se dibuja | Señal | Criterio |
|---|---|---|
| Campo de slug editable con previsualización (`SlugPreviewField`) | `!isStoreAddressCommitted` | 21 (control) |
| Campo de slug bloqueado + «no se puede cambiar desde Cuadre de Caja» | `isStoreAddressCommitted` | 21 |
| Fila de dirección pública, como enlace | `isKnownInOnlineStore` | 2 |
| «Pediste «X» y te asignaron «Y»» | `isKnownInOnlineStore` **y** `slug !== slugQab` | 3, 22 |
| Nota del panel («Este interruptor es tu permiso…») | `isKnownInOnlineStore` | 11 |
| «Vacío: se va a borrar de tu tienda online» + banner de recuento | `isKnownInOnlineStore` | 23, 7 |
| «Opcional. Si lo dejas vacío, no aparece en tu tienda.» | `!isKnownInOnlineStore` | 24 |
| Pill `Sin publicar` / `Despublicado` | `firstPublishPending` (ya, ADR 0035) | 14 |

De ahí salen **tres** estados de la tarjeta de dirección donde F-005 tenía dos, y el nuevo es el
del medio: publicado, con la dirección ya congelada, y todavía sin conocerla. En ese estado no se
dibuja ninguna URL ni ningún aviso de divergencia —no hay valor que mostrar—, y el campo se ve
bloqueado con el valor que el comerciante pidió.

## Por qué (b) no usa también `firstPublishPending`

Porque la frase que gobierna es «**se va a borrar** de tu tienda online», y afirmar un borrado
exige saber que hay algo que borrar. El diseño de F-005 ya rechazó ese discriminador con el
argumento correcto: `firstPublishPending === false` significa «probablemente existe allá», y
«probablemente» no basta para una frase que promete una pérdida de datos; si el evento quedó
`FAILED` o `BLOCKED`, el aviso sería falso. `slugQab != null` no es «probablemente»: es QAB
respondiendo que sí.

Y por eso mismo (a) **sí** puede usar `firstPublishPending`: bloquear un campo por exceso de
prudencia no afirma nada falso —la dirección, en cuanto ese evento se aplique, quedará congelada—
mientras que dejarlo editable sí afirma algo falso, que escribirlo sirve para algo.

Es la regla de E-013 aplicada al pie de la letra: **dos preguntas distintas, dos señales distintas**,
cada una definida en un solo sitio y consumida por importación, nunca reescrita en el componente.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Bloquear el campo solo con `slugQab != null` (dejar la ventana editable, como en F-005) | Es la opción que el diseño de F-005 dejó en suspenso midiendo su coste: en esa ventana el campo se puede escribir y no hace nada. Y el coste no es acotado: si la lectura lateral no llega a aprender el valor, la ventana no se cierra nunca. |
| Usar `slugQab` para las dos preguntas (lo que hacía F-005) | Es literalmente E-013. |
| Usar `firstPublishPending` para las dos preguntas | Rompe los criterios 23 y 24 en el caso `FAILED`/`BLOCKED`: la pantalla prometería un borrado de datos que no existen del otro lado, que es el error más caro de los dos posibles (regla 2 del spec de F-005). |
| Una tercera señal derivada de «existe un `STORE` aplicado de este local» (`procesadoAt IS NOT NULL`), que es la condición honesta de «la dirección ya está congelada» | Es la más precisa de las tres, y se descartó por coste/beneficio: obliga a añadir un campo nuevo a `ITiendaOnlineLocal` y una consulta más al GET de la configuración, para distinguir un caso —primer publish fallido y todavía reintentándose— en el que la pantalla **ya avisa** por otra vía: `syncState` dice `FAILED` o `BLOCKED` con su código (ADR 0034). Queda anotada como la salida si algún día el bloqueo prematuro molesta de verdad. |
| Reescribir la condición en cada tarjeta (`!local.firstPublishPending` a mano en tres archivos) | Es E-014: la definición parafraseada en N sitios, y la próxima corrección deja alguna atrás. Las dos señales son funciones puras importadas; los componentes no vuelven a nombrar ni `firstPublishPending` ni `slugQab`. |

## Consecuencias

**A favor:**

- Cada pregunta tiene su señal, con su nombre literal y su definición en un solo módulo. Un `grep`
  de `slugQab` en `src/components/` debe devolver **solo** `publicationPresentation.ts`.
- Las dos señales son funciones puras en un `.ts`, no en un `.tsx`, así que la suite las puede
  cargar: la decisión de qué lee el comerciante queda cubierta por tests, que es lo único que el
  entorno `node` de Vitest permite verificar de la UI.
- Se cierra la deuda de F-005: los dos copys diferenciados del campo vacío y el banner de recuento
  vuelven a tener discriminador, y `emptyContactFields` vuelve a tener consumidor.

**En contra / coste asumido:**

- Un local cuyo primer publish **falló** verá su campo de dirección bloqueado aunque la tienda no
  exista todavía del otro lado y el slug siga siendo semilla. Es reversible (cambiar una condición)
  y no es silencioso: la tarjeta de estado de sincronización dice que el envío falló y por qué.
- Los controles «con `slugQab === null` el campo sigue editable» de los criterios de diseño 21 y
  del criterio 6 del spec quedan **desactualizados por esta decisión**: el control correcto es «con
  `firstPublishPending === true` el campo sigue editable». El contrato de interfaces de F-020 lo
  reescribe explícitamente para que `qa` no lo verifique contra la redacción vieja.

**Impacto en seguridad y escalabilidad:**

- Ningún dato nuevo se expone: `TIENDA_ONLINE_LOCAL_SELECT` ya selecciona `slug`, `slugQab`,
  `nombre` y los nueve campos de contacto, y `firstPublishPending` ya viaja en
  `ITiendaOnlineLocal`. No hay columna, consulta ni endpoint nuevos en el camino de lectura.
- Ninguna de las dos señales es una decisión de autorización: el permiso de la pantalla lo sigue
  resolviendo el backend (`permisos_back.ts`) y el GET de la configuración sigue filtrando por
  `negocioId`.
