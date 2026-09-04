# E-013: Una columna que nadie escribe, usada como señal de estado

**Área:** ui
**Apariciones:** 1 — F-005 (ciclos 1 y 2 de QA; el mismo patrón en tres archivos distintos)

## Síntoma

No hay mensaje de error. La pantalla funciona, compila, pasa `tsc` y pasa la suite; simplemente
**decide siempre por la misma rama**. Reproducido por el `qa` en el navegador:

```
Publicar un local → despublicarlo con motivo → volver a publicarlo
  → el diálogo «¿Cómo va a aparecer este local?» vuelve a preguntar lo ya contestado
  → el pill dice «Sin publicar» en vez de «Despublicado»
```

Y en la misma pantalla, dos ciclos después:

```
Un campo de contacto vacío muestra SIEMPRE «Opcional. Si lo dejas vacío, no aparece en tu tienda»
  → nunca el copy alternativo, que era el correcto la mitad de las veces
```

## Causa raíz

La UI usaba `Tienda.slugQab !== null` como señal de «este local ya existe en la tienda online».
La columna existe, es del tipo correcto y se lee sin problema — pero **nada la escribe**. El propio
contrato de interfaces lo decía con todas las letras, en un comentario que nadie contrastó contra
los sitios que dependían de ella:

```
`slugQab` is absent on purpose: QAB owns it and this feature never writes it.
```

Una columna que nadie escribe no da un error: da un valor. `null`, para siempre. Y una condición
que siempre es falsa no se distingue de una condición correcta cuyo caso contrario no se probó.

Por eso apareció **tres veces** —`page.tsx`, `PublicationStatusCard.tsx`, `PublicDataCard.tsx`— y
por eso el tercero sobrevivió al ciclo que arregló los dos primeros.

## Solución

Dos pasos, y el segundo es el que importa:

1. Sustituir la señal por una que sí se escribe. Aquí, `firstPublishPending`, derivada del outbox
   (ver [E-014](E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md) y el ADR 0035, porque el
   primer intento de sustituto **también** estaba mal definido).
2. Para los usos que necesitaban el **valor** y no un booleano —la URL pública real, el aviso de
   «pediste X y te asignaron Y»— no había sustituto posible: se abrió **F-020** para poblar la
   columna de verdad, y sus criterios quedaron marcados como diferidos en vez de borrados.

## Cómo evitarlo

**Antes de gatear un estado con una columna, comprobar quién la escribe.** Un `grep` del nombre de
la columna sobre `src/` que solo devuelva lecturas es la señal: si nadie escribe, no es una señal,
es una constante.

Tres reglas concretas que salieron de esto:

- **No uses una sola señal para dos preguntas distintas.** `slugQab` respondía a la vez «¿ya se
  publicó?» y «¿cuál es la dirección?». La primera es un booleano y la segunda un valor; cuando se
  colapsan, arreglar una rompe la otra.
- **Un criterio marcado DIFERIDO trae su propio «qué comprobar en su lugar», y eso hay que
  ejecutarlo.** Comprobar que el criterio original no se ejecuta **no basta**: así se coló la
  tercera aparición, en un archivo que el ciclo anterior no tocó porque su criterio estaba
  diferido. Diferido no significa que el copy actual pueda seguir mintiendo.
- **Si la condición siempre da la misma rama, el test que solo prueba esa rama pasa igual con el
  código roto.** Es [E-008](E-008-datos-de-prueba-que-no-discriminan.md) con otra ropa: la
  verificación tiene que sembrar las dos ramas y afirmar que **no colapsan**.
