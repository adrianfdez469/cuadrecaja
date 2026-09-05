# E-041: Un roving `tabIndex` derivado de «qué está elegido» en vez de «dónde está el recorrido»

**Área:** ui
**Apariciones:** 1 — F-014

## Síntoma

Un grupo de radio reimplementado a mano falla de **tres formas** que parecen independientes:

1. **Dos puntos de tabulación en vez de uno.** Con nada seleccionado, los dos `[role="radio"]`
   tienen `tabIndex="0"` a la vez, y un recorrido real de `Tab` los visita como dos paradas.
2. **El primer `ArrowDown` selecciona la opción equivocada** — la primera en vez de la segunda.
3. **La selección se mueve pero el foco no la sigue**: `aria-checked` cambia de fila mientras
   `document.activeElement` se queda en la anterior.

El tercero es el grave, y es **silencioso**: pulsar `Espacio` después de navegar con flechas —la
acción natural— dispara el `onKeyDown` del elemento que **de verdad** tiene el foco, y **revierte la
selección**. En F-014 eso significaba escribir la forma de pago equivocada en una `Venta`, sin que
nada avisara.

## Causa raíz

**Una sola, y las tres caras eran síntomas suyos.** El `tabIndex` se derivaba de `metodo` —«qué está
elegido»— cuando lo que gobierna un roving `tabindex` es **«dónde está el recorrido»**. Son dos
estados distintos:

- Con `metodo: null` no hay elección, así que la expresión daba `0` a los dos → dos tab stops.
- El cálculo del salto partía de `indexOf(metodo)`, que con `null` da `-1`, y `(-1 + 1) % 2 = 0` →
  el primero.
- Y como el estado se movía sin llamar a `focus()`, el foco del navegador se quedaba atrás.

**Esto es el precio exacto de renunciar al componente de la biblioteca.** Hubo que hacerlo por una
razón buena: el `Radio` de MUI renderiza un `<input>` con `role: undefined` **explícito**
(`SwitchBase.js:193`), así que `querySelectorAll('[role="radio"]')` no habría encontrado **nada**, y
anidar ese input dentro de un `role="radio"` daría doble semántica al lector de pantalla. Pero al
reimplementar el rol **hay que reimplementar el patrón de teclado entero**, y ahí selección y
recorrido dejan de ser lo mismo.

## Solución

Un **único «índice activo»**, con el recorrido como estado propio:

```ts
const chosenIndex = metodo === null ? -1 : OPTIONS.indexOf(metodo);
const rawActiveIndex = chosenIndex >= 0 ? chosenIndex : roving;
const activeIndex = isEnabledIndex(rawActiveIndex) ? rawActiveIndex : firstEnabledIndex;
```

`roving` arranca en la primera fila habilitada; en cuanto hay elección, `metodo` manda, así que los
dos no pueden discrepar. El `tabIndex` es `index === activeIndex ? 0 : -1` — exactamente una parada,
siempre. Y `choose()` llama a `element.focus()` **antes** de propagar el cambio de estado, para que
selección y foco viajen juntos.

El clamp final cubre un caso que nadie había pedido: si las opciones habilitadas cambian con el
diálogo abierto, una parada de tabulación sobre una fila deshabilitada sería un callejón sin salida.

## Cómo evitarlo

**Cuando reimplementes un patrón ARIA que la biblioteca te daba hecho, el comportamiento de teclado
es parte de lo que reimplementas, no un extra.** Concretamente, en un grupo de radio: «qué está
seleccionado» y «dónde está el recorrido de tabulación» son **dos estados**, y el segundo tiene que
existir aunque no haya nada seleccionado.

**Y verifícalo por identidad de nodo, no por texto.** El defecto 3 solo se ve comparando
`document.activeElement` con el nodo esperado (`el === document.activeElement`); una comprobación
por `textContent` habría dado verde.

**Para quien escribe contratos de diseño:** este criterio existía porque el `ui-designer` anticipó
que el patrón de teclado dejaba de venir hecho, y lo escribió como **exigencia y no como
descripción**. Sin ese criterio, el fallo se habría ido a producción — los tres defectos son
invisibles con ratón, y no hay tests de componentes en este repo.
