# E-060: Una identidad de referencia usada como si fuera un valor

**Área:** ui
**Apariciones:** 2 — F-029 (las dos, en el mismo tramo de UI)

## Síntoma

Dos formas distintas, ningún error, `tsc` y `npm run lint` en **exit 0** las dos veces.

**Variante A — bucle de render infinito.** Un componente que envuelve el `containerRef` de
`useVirtualRows` para además guardarse el nodo:

```tsx
<div ref={(el) => { mio.current = el; virtual.containerRef(el); }}>
```

Al montar, re-renderiza sin parar. No hay excepción, no hay aviso: solo la pestaña calentándose.

**Variante B — la selección del operador se borra sola.** Dentro del diálogo de selección de
ventas, lo que el cajero acababa de elegir desaparecía en momentos aparentemente aleatorios. No se
reproduce mirando el diálogo aislado: hace falta que **algo ajeno** re-renderice la página que lo
contiene.

## Causa raíz

La misma en las dos: **una identidad de referencia nueva en cada render, usada donde se esperaba un
valor.**

En **A**, `useVirtualRows` guarda el scroller en `useState`, no en un `useRef`, y lo documenta: los
refs se enlazan de abajo arriba, así que un hijo renderiza mientras el ref de su padre sigue en
`null`. Por eso su `containerRef` es un `useCallback` **estable a propósito**. Un envoltorio
anónimo es una función nueva en cada render, React desengancha y reengancha el ref, y cada ciclo
hace `setState(null)` seguido de `setState(el)` → render → ref nuevo → otra vez.

En **B**, la página calculaba en su cuerpo:

```tsx
const salesCutoffAt = data?.salesCutoff?.cutoffAt ? new Date(data.salesCutoff.cutoffAt) : null;
```

Valor correcto y **objeto nuevo cada render**. El hijo lo tiene en las dependencias del `useEffect`
que reinicia su estado local al abrirse, así que ese efecto se dispara con cualquier render del
padre.

Lo que hace a esta familia peligrosa es que **ninguna herramienta la ve**: `tsc` no modela
identidad, y `exhaustive-deps` está *satisfecho* —la dependencia sí está declarada, el problema es
que cambia siempre—. El código del hijo es correcto leído solo. El fallo aparece **lejos de donde
se escribió**.

## Solución

- **A:** cualquier envoltorio de un `containerRef` de `useVirtualRows` va en `useCallback` con el
  propio `containerRef` como dependencia.
- **B:** memoizar **en el origen**, sobre el valor primitivo, no en el consumidor:
  `useMemo(() => raw ? new Date(raw) : null, [raw])`, o sobre su `getTime()`.

## Cómo evitarlo

Dos reglas cortas, y las dos son la misma:

- **Una `ref` de callback que acaba en un `setState` no puede ser una función anónima en línea.**
- **`new Date(...)`, `[...]` y `{...}` escritos en un JSX no son valores: son identidades nuevas.**
  Si van a acabar en un array de dependencias, se memoizan donde nacen.

Hermano en el mismo hook: meter el objeto que devuelve `useVirtualRows` en las dependencias de un
`useEffect` — devuelve un objeto literal nuevo cada render, así que el efecto se dispara siempre.
Se lee por un `useRef` actualizado en cada render.

Se detectan **releyendo**, no ejecutando ni compilando, que es como aparecieron las dos. Emparentado
con [[E-013]] y [[E-058]]: una señal que el lenguaje da por buena y que no significa lo que el
código supone.
