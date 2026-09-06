# E-036: `strict: false` rompe el estrechamiento de una unión discriminada por booleano

**Área:** build
**Apariciones:** 1 — F-009

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
