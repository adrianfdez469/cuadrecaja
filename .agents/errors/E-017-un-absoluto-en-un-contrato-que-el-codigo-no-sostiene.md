# E-017: Un absoluto escrito en un contrato o un ADR que el código no sostiene

**Área:** build
**Apariciones:** 1 — F-020 (la misma frase en **cinco** sitios, más una segunda frase del mismo género)

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
