# E-003: Un literal `BigInt` no compila porque el target de TypeScript es ES2017

**Área:** tests
**Apariciones:** 1 — F-001

## Síntoma

```
TS2737: BigInt literals are not available when targeting lower than ES2020.
```

Al escribir un test con un literal de la forma `880n`.

## Causa raíz

`tsconfig.json` de este repositorio fija `"target": "ES2017"`. La sintaxis de literal `BigInt`
(el sufijo `n`) exige ES2020 o superior. No es un problema de la versión de Node —que soporta
`BigInt` desde hace años— sino del target de compilación: TypeScript rechaza la **sintaxis**
antes de que Node vea nada.

## Solución

Usar el constructor en lugar del literal:

```ts
BigInt(880)        // en vez de  880n
BigInt("9007199254740993")
```

## Cómo evitarlo

**En este repo, `BigInt` se escribe siempre con el constructor, nunca con el sufijo `n`.**

Es una trampa garantizada para toda la integración con queandabuscando, cuyos ids de pedido son
`BIGINT` y cuya comparación **tiene** que hacerse en `BigInt` (`"9" > "10"` es cierto
lexicográficamente, y `Number` miente por encima de 2^53). Cualquiera que escriba código o tests
de esa comparación se topará con esto.

Subir el target a ES2020 lo resolvería de raíz, pero es un cambio de alcance del proyecto entero
y no de un feature: si alguien lo hace, que sea a propósito y con su ADR.
