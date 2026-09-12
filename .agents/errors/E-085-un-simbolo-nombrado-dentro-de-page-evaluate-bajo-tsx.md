# E-085: Un símbolo nombrado dentro de `page.evaluate()` ejecutado con `tsx`

**Área:** tests
**Apariciones:** 1 — F-048 (QA)

## Síntoma

Un script de verificación con Playwright, lanzado con `tsx`, revienta en el navegador con:

```
ReferenceError: __name is not defined
```

El error apunta al **contexto de la página**, no al script, y no menciona nada que aparezca en el
código escrito. El primer diagnóstico se fue al objeto de argumentos desestructurado, que no tenía
nada que ver: costó dos iteraciones.

## Causa raíz

`tsx` usa esbuild, que **envuelve toda función nombrada** —`function foo() {}` y también
`const foo = () => {}`— con un helper `__name(...)` al preparar el módulo para Node. Es lo que
conserva el `.name` de la función tras la transformación.

Playwright serializa la función que se le pasa a `page.evaluate()` con **`.toString()`** y la
inyecta en el contexto del navegador. Lo que viaja es el **texto transformado**, con la llamada a
`__name` dentro — pero el helper **se queda en Node** y nunca llega al navegador.

Una función **anónima** no se envuelve, y por eso el mismo patrón funciona la mayoría de las veces:
el fallo solo aparece cuando dentro del `evaluate` hay un símbolo **con nombre**.

## Solución

Pasar el cuerpo como **cadena**, que nunca atraviesa la transformación de esbuild, e interpolar los
argumentos con `JSON.stringify`:

```ts
await page.evaluate(`(() => { /* ... */ })()`);
```

## Cómo evitarlo

- Dentro de un `page.evaluate()` bajo `tsx`, **no declares símbolos con nombre**. Si el bloque es lo
  bastante grande como para necesitarlos, pásalo como cadena.
- Regla de diagnóstico, que es lo que aquí costó: **un `ReferenceError` de un identificador que no
  aparece en tu código es de la herramienta que transformó el código, no de tu código.** `__name`,
  `__toESM` y `__commonJS` son helpers de esbuild; verlos en un error del navegador significa que
  algo cruzó el límite Node → página llevándose la transformación puesta.

No mordió a las verificaciones de F-029, F-030 ni F-047 por casualidad: allí los `evaluate` no
declaraban funciones nombradas.
