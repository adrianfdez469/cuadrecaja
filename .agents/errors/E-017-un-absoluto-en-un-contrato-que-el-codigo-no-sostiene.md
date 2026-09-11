# E-017: Un absoluto escrito en un contrato o un ADR que el código no sostiene

**Área:** build
**Apariciones:** 3 — F-020 (la misma frase en **cinco** sitios, más una segunda del mismo género) · F-006 (**cuatro** criterios de diseño, ver la primera adenda) · F-036 (una afirmación de uso cierta del **valor** y falsa del **símbolo**, ver la segunda adenda)

## Síntoma

No hay error. Hay una frase, escrita con mayúsculas y sin cualificar, que promete más de lo que el
código cumple:

```
/** The learning phase. NEVER THROWS: every failure comes back as an entry of results[]. */
```

Y en otro sitio, sobre la misma función:

```
Sin N+1: ninguna consulta se hace por local.
```

Las dos son ciertas **a medias**. Ningún desenlace de la lectura lateral tumba la fase, cierto; un
fallo de base de datos sí se propaga, porque las consultas no van envueltas. Ninguna **lectura** se
hace por local, cierto; la escritura sí, un `updateMany` por local aprendido.

## Causa raíz

Un absoluto es más corto y más satisfactorio de escribir que su versión cualificada, y cuando se
escribe **antes** de que el código exista —que es justo lo que hace un contrato de interfaces— nadie
lo contrasta contra nada. Luego se propaga por copia: la frase nació en el ADR y acabó en el JSDoc
del contrato, en el comentario del punto de llamada, en el código de dos archivos distintos y en el
plan de tests.

El daño real no es el comentario. Es que **el paso siguiente del pipeline lee el contrato como su
especificación**: un `qa` que lee «nunca lanza» sobre un código que sí propaga rechaza código
correcto. Y hay una variante peor, que apareció en el § 14 (el plan de tests):

```
`learnQabAssignedSlugs` con `fetchSlug` inyectado y la base sembrada — que nunca lanza, que respeta…
```

Ahí la frase ya no **describe** el comportamiento: **instruye al `dev-tester` a fijar un absoluto
falso**. Que el test acabara correctamente acotado a fallos de la lectura lateral fue suerte, no
diseño — y un test que fija una promesa falsa la vuelve incuestionable, porque ahora hay algo verde
defendiéndola.

## Solución

Partir cada absoluto en **dos mitades contrastables**, y decir por qué la mitad incómoda es
deliberada:

- lo que **no** puede tumbar la fase: los siete desenlaces de la lectura lateral, enumerados, cada
  uno como entrada de `results[]`;
- lo que **sí** propaga: un fallo de base de datos, igual que en el drenaje, con las tres consultas
  sin envolver nombradas — y el motivo, que tragárselo esconde un pool roto detrás de un informe
  lleno de ceros.

Y **empezar por el ADR**, no por el contrato: el propio contrato declara que en caso de
contradicción gana el ADR, así que arreglar solo el contrato deja la frase lista para resembrarse en
la próxima lectura.

## Cómo evitarlo

**Un contrato no puede afirmar un absoluto sobre código que todavía no existe.** Tres reglas
concretas:

- **Al escribir «nunca», «ninguno», «siempre» o «todo» en un contrato o un ADR, escribe al lado la
  excepción o la cualificación.** Si de verdad no hay ninguna, dilo con la enumeración cerrada de
  los casos, que es contrastable; «nunca» no lo es.
- **La frase más peligrosa no es la que describe, es la que instruye.** Un absoluto en la sección de
  plan de tests fabrica un test que lo defiende. Revisa esa sección aparte.
- **Cuando el implementador te avise de que un comentario del contrato es falso, arréglalo ANTES del
  `qa`, no en el cierre.** Es la diferencia entre corregir una frase y gastar un ciclo de rechazo
  contra código correcto. Y busca la frase en todos sus sitios: `grep` del absoluto, no del archivo.


---

## Adenda (F-006): el absoluto que incumple un componente compartido preexistente

El subcaso más frecuente de este error, y el que más barato es de prevenir.

En F-006 aparecieron **cuatro** criterios de diseño con la misma forma: un absoluto sobre el DOM que
**ningún** implementador podía satisfacer, porque quien lo incumple es el componente compartido que
el propio contrato manda reutilizar.

| Criterio | El absoluto | Quién lo incumple solo |
|---|---|---|
| 50 | «En ningún estado existe un `.MuiCircularProgress-root` en el DOM» | `AppDialog.tsx:135` lo pinta como `startIcon` cuando `confirm.loading` — y el contrato manda usar `AppDialog` con `loading` |
| 8 | «El `text-overflow` computado no es `ellipsis` en ningún texto de la lista» | `.MuiChip-label` lo trae de MUI (`Chip.js:312`), y `StatusPill` es un `Chip` |
| 27 | «No existe ningún `Drawer` de acciones» | El menú lateral del `Layout` también es un `Drawer` |
| 33 | «En ningún texto visible aparece la cifra `eventos`» | Cualquier precio o contador que coincida numéricamente |

El caso 50 es el más ilustrativo: la **prosa** del mismo documento decía tres veces «ningún
`CircularProgress` **suelto**», y el criterio se comió la palabra «suelto». El contrato se
contradecía consigo mismo, y el `implementer` hizo lo correcto —seguir la prosa y **reportarlo**, en
vez de rediseñar un componente compartido para satisfacer un criterio mal escrito.

**El chequeo barato, y la regla que faltaba:** antes de escribir «ningún X en el DOM», **abre el
componente compartido que mandas reutilizar y mira qué renderiza**. Si lo renderiza él, el que cede
es el criterio, no el componente.

Dos matices que hicieron falta al corregirlos:

- **Acotar el alcance**, no solo la condición: `document` incluye el chrome del `Layout`, que tiene
  sus propios spinners, su propio `Drawer` y su propio texto. Ver [E-011](E-011-medir-el-contenedor-equivocado-de-mui.md).
- Un repaso que solo comprueba **subcadenas de copy** —como el de [E-016](E-016-un-criterio-que-exige-una-subcadena-que-el-copy-no-tiene.md)— **no ve esta clase de fallo**. Son dos repasos distintos.


---

## Adenda (F-036): la afirmación de uso que es cierta del valor y falsa del símbolo

La variante más silenciosa de las tres, porque **no usa ningún superlativo** y por eso no la caza
ninguna búsqueda de «NEVER», «ningún» o «siempre».

El contrato de F-036 escribió, sobre una constante del módulo de schemas que el propio contrato
mandaba conservar:

```
TRANSFER_METHOD sigue existiendo y no se toca: buildOnlineSaleAmounts y los dos componentes lo usan.
```

Suena a hecho comprobable y **lo es** — pero comprueba lo que no es. Los tres consumidores usan la
**cadena** `"TRANSFERENCIA"`; ninguno importa **ese símbolo**. `orderLandingPlan.ts` tiene su propio
`PAYMENT_TRANSFER`, y `PedidoEntregaDialog.tsx` y `PedidoPagoFields.tsx` declaran cada uno su propia
constante local **con el mismo nombre**. El único lector del símbolo del módulo de schemas era el
`superRefine` que el contrato mandaba reescribir.

Resultado: seguir el contrato al pie de la letra dejaba una variable muerta, y
`@typescript-eslint/no-unused-vars` está en **`"error"`** en este repositorio, así que
`npm run lint` salía con exit 1. El `implementer` lo escribió como mandaba el contrato, y solo lo
descubrió al verificar.

**Por qué se escribe este error:** un `grep TRANSFER_METHOD src/` devuelve coincidencias en los tres
archivos y confirma la frase. Lo que no distingue es **de qué declaración** viene cada una — y con
tres constantes locales homónimas, la evidencia parece más fuerte de lo que es.

**La regla:** antes de escribir en un contrato «X lo usa Y», comprueba que Y **importa** X, no que Y
mencione su nombre. Para un símbolo no exportado, la pregunta correcta es más corta y no admite
ambigüedad: *¿quién lo lee dentro de este mismo archivo?* Si la respuesta es «solo el código que
este contrato manda reescribir», entonces el símbolo **no sobrevive**, y decir que se conserva es
mandar dejar código muerto.
