# E-036: `strict: false` rompe el estrechamiento de una unión discriminada por booleano

**Área:** build
**Apariciones:** 2 — F-009, F-039 (`zoneTariffPrecedence.ts`)

## Síntoma

```
src/lib/tiendaOnline/tiendaOnlineSso.ts(42,62): error TS2339: Property 'reason' does not exist on
type '{ available: true; secret: string; baseUrl: string; } | { available: false; reason: ... }'.
```

El código que lo produce es el idioma normal de TypeScript, y por eso el mensaje despista:

```ts
if (!availability.available) {
  return { outcome: "not_configured", reason: availability.reason };
}
```

## Causa raíz

**No es que la unión esté mal declarada.** Es que `tsconfig.json` de este repo tiene
`"strict": false`, y **sin `strictNullChecks` el compilador no trata `true`/`false` como
discriminante en un test de veracidad**. `if (!x.available)` no estrecha nada, así que en esa rama
el tipo sigue siendo la unión entera — y la unión entera no tiene `reason`.

El mensaje apunta al sitio equivocado: señala la propiedad y el tipo, y da a entender que falta un
miembro o que la unión está mal construida. Nada de eso pasa.

## Solución

Comparar contra el literal en vez de usar el test de veracidad:

```ts
if (availability.available === false) {
  return { outcome: "not_configured", reason: availability.reason };
}
```

Con la comparación explícita el compilador sí estrecha, incluso sin `strictNullChecks`. La firma y
el orden de evaluación no cambian.

## Cómo evitarlo

**Con `strict: false`, una unión discriminada por un campo booleano se estrecha con
`x.flag === false` (o `=== true`), nunca con `!x.flag`.**

Y hay motivo para esperar que reaparezca: el contrato de F-009 es **el primero del módulo** que
devuelve una unión discriminada por booleano. El precedente que había, `resolveAutoProvisioningAvailability`,
esquiva el problema devolviendo un tipo plano con `reason: … | null` — así que quien copie ese
patrón no se topa con esto, y quien escriba una unión nueva sí.

Dos notas de proceso, porque aquí funcionaron:

- **El `dev-tester` lo encontró y no pudo tocarlo**, porque `src/**` no es su frontera. Lo reportó y
  lo corrigió el `implementer`. La separación implementación/tests hizo exactamente lo que promete.
- **`npm test` estaba en verde con este error sin corregir**, porque Vitest no comprueba tipos. Es
  [E-026](E-026-la-suite-en-verde-no-implica-tsc-limpio.md) en directo: `npx tsc --noEmit` no es
  opcional.


---

## Adenda F-039 — la dirección contraria, y es la peligrosa

En F-009 `strict: false` hizo que `tsc` **fallara** sobre código correcto: el estrechamiento no
ocurría y el compilador se quejaba. Molesto, pero ruidoso: hay un error, se ve, se arregla.

F-039 dio con el reverso, que no hace ruido ninguno. La primera versión de `resolveZoneTariff`
calculaba el veredicto de un escalón en una función auxiliar y, ya de vuelta en el llamador, leía
`row.deliveryFee` para formatearlo — confiando en un estrechamiento que había ocurrido **dentro de
la otra función** y que no viaja de vuelta. Con `strict: false`, `row` posiblemente `undefined` y
`deliveryFee` posiblemente `undefined` son ambos asignables, así que **`tsc --noEmit` dio exit 0**
sobre código que en una de sus ramas habría llamado a `toFixed` sobre `undefined`.

El fallo no habría sido de tipos: habría sido un `TypeError` en ejecución, en la rama menos
transitada, mucho después.

**Cómo se cerró:** que el auxiliar devuelva también el importe (`amount: number | null`) junto al
veredicto que lo autoriza, de modo que el dato viaje con la decisión que lo justifica y no haya
ninguna lectura que dependa de un estrechamiento perdido en el camino.

**La regla que deja:** con el modo estricto desactivado, **el compilador no es una red bajo un
refactor que parte una función en dos**. Exit 0 no significa que el refactor conservó las
garantías; significa que el compilador dejó de mirar. Si al extraer un auxiliar el llamador sigue
leyendo un campo que solo era seguro por una comprobación que ahora vive dentro del auxiliar, el
dato tiene que salir del auxiliar, no volverse a leer fuera.
