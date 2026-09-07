# E-053: un script de verificación suelto no es el entorno de módulos del repositorio

**Área:** tests
**Apariciones:** 1 — F-008 (dos veces en el mismo feature, por dos mecanismos distintos)

## Síntoma

Dos agentes de F-008 intentaron verificar código de producción con un script desechable, y los dos
perdieron una iteración por la **resolución de módulos**, no por su código:

1. **`implementer`** — `npx tsx <scratchpad>/routecheck.ts` falló con `MODULE_NOT_FOUND` sobre
   `next/server`. Lo desconcertante: el **mismo** script resolvía `@/`, `zod` y `@prisma/client`
   sin problema.
2. **`qa`** — `tsx` con imports relativos de `.ts` **de este repo** (no de paquetes npm) **no
   exponía los exports nombrados**: `cjs-module-lexer` falla la detección estática incluso en un
   archivo trivial como `cronAuth.ts`. Con `node --import tsx` y con `vitest`, los mismos archivos
   cargan bien.

## Causa raíz

Son dos mecanismos distintos con la misma raíz: **un script fuera del árbol del proyecto no hereda
el entorno de módulos del proyecto.**

- El primero, por **ubicación**: la resolución de `node_modules` sube desde el directorio del
  script, y `/private/tmp/...` no tiene ninguno. Lo que confunde es que los imports que sí
  funcionaban resolvían por otra vía (el `tsconfig` con el alias, y paquetes ya cargados), así que
  el fallo parecía específico de `next/server` cuando era del directorio.
- El segundo, por **cargador**: `tsx` a secas y `vitest` no analizan los módulos igual. Un export
  nombrado que `vitest` ve, `tsx` puede no verlo.

En los dos casos el mensaje señala al import, no a la causa.

## Solución

- El primero: mover el script temporal a la **raíz del repositorio** y borrarlo después.
- El segundo: escribir la verificación como un **`.test.ts` temporal** y ejecutarlo con
  `vitest run`, borrándolo al terminar.

## Cómo evitarlo

**Para verificar código de producción de este repo, usa el cargador del repo.** Un `.test.ts`
temporal ejecutado con `vitest run` —y borrado después— resuelve los alias, los paquetes y los
exports nombrados exactamente como lo hará la suite, que es justamente lo que se quiere comprobar.

Un script en el scratchpad sigue siendo la herramienta correcta para lo que **no** importa código
del repo (calcular un hash a mano, comparar dos algoritmos de orden, verificar un valor del
contrato). En cuanto haya un `import` de `src/`, deja de serlo.

**Y ojo con la frontera de escritura:** si el `.test.ts` temporal vive en `src/__tests__/`, es la
frontera del `dev-tester`. Durante el paso 5, con los dos agentes en paralelo, eso es E-046 —
créalo fuera de esa carpeta, o espera a que el paso cierre.
