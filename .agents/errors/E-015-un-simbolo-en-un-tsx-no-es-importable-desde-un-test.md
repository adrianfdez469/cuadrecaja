# E-015: Un símbolo que vive en un `.tsx` no es importable desde ningún test

**Área:** tests
**Apariciones:** 1 — F-005 (ciclo 2, escribiendo el test que el ciclo 1 había pedido)

## Síntoma

Vitest falla al importar un componente, y el mensaje señala una línea de JSX cualquiera, como si el
archivo estuviera roto:

```
Error: Failed to parse source for import analysis because the content contains invalid JS syntax.
If you use tsconfig.json, make sure to not set jsx to preserve.
```

No es específico del archivo que se intenta importar: se reproduce con **cualquier** `.tsx` del
repositorio, incluido uno sin ninguna relación con lo que se está probando.

## Causa raíz

`tsconfig.json` tiene `"jsx": "preserve"` —lo correcto para el compilador de Next— y
`vitest.config.ts` no lo sobreescribe con ningún `esbuild.jsx`. Así que esbuild deja el JSX tal
cual, y lo que sale de la transformación ya no es JavaScript válido.

Lo importante es el alcance, que es mayor que el que documenta `AGENTS.md`: ese archivo atribuye la
ausencia de tests de componentes a que **no está instalado `@testing-library/react`**, y la razón
de fondo es anterior y más dura — **ningún símbolo que viva en un `.tsx` es importable desde un
test**, aunque sea una función pura sin una línea de React dentro.

Aquí mordió de la forma más incómoda posible: la función `publicationPresentation` se había
extraído **deliberadamente** como función pura y exportada, y era el sitio exacto donde el ciclo 1
de QA había pedido el test que habría atrapado un defecto antes que el navegador. Estaba en un
`.tsx`, así que era inverificable.

## Solución

Mover la función pura y su tipo a un `.ts` plano
(`src/components/tiendaOnline/publicationPresentation.ts`), y que el componente la importe de ahí
—re-exportándola si hace falta por compatibilidad—. El test importa **del `.ts`**, nunca del
componente, o vuelve al mismo muro.

Se descartó a propósito el otro arreglo, `esbuild: { jsx: "automatic" }` en `vitest.config.ts`:
habilitaría probar funciones puras de cualquier componente, pero es infraestructura compartida de
todo el repositorio y no se cambia desde dentro de un feature. Queda pendiente como mejora con su
propio ADR, si alguien la quiere.

## Cómo evitarlo

**La lógica pura de una pantalla nace en un `.ts`, no en el `.tsx` del componente.** Si decide algo
que un test debería poder afirmar —qué rótulo se muestra, qué estado se pinta, qué copy
corresponde—, sacarla desde el principio cuesta un archivo; sacarla después cuesta un ciclo de QA.

Dos avisos más:

- **El mensaje de error no dice lo que pasa.** Señala una línea de JSX y habla de «invalid JS
  syntax», así que el primer instinto es buscar el fallo en el componente. Antes de eso, probar a
  importar cualquier otro `.tsx`: si también falla, es la configuración.
- **Un agente con la frontera en `src/__tests__/**` no puede arreglar esto**, y el que tiene
  `src/**` tampoco puede tocar `vitest.config.ts`. Cuando el arreglo cae fuera de las fronteras de
  los dos agentes que sufren el problema, hay que reportarlo hacia arriba — no rodearlo duplicando
  la lógica dentro del test, que es lo que lo convertiría en un test decorativo.
