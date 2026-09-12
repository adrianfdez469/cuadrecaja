# E-077: un `const` con nombre dentro de `page.evaluate` revienta por el `keepNames` de esbuild

**Área:** tests
**Apariciones:** 1 — F-036

## Síntoma

Un script de verificación de Playwright escrito en TypeScript y ejecutado con `tsx` falla dentro
del navegador, no en Node:

```
ReferenceError: __name is not defined
```

El script compila, el selector es correcto y la página está cargada. El error no señala a ninguna
línea del código escrito: señala a un identificador que nadie escribió.

## Causa raíz

`page.evaluate` **no envía código**: serializa la función con `toString()` y la reconstruye en el
contexto del navegador. Y el transform de esbuild que `tsx` aplica al archivo `.ts` lleva
`keepNames` activado, que envuelve **toda función asignada a un `const` con nombre** en un helper
propio para preservar su `.name`:

```js
const amountOf = __name((el) => el.querySelector("p"), "amountOf");
```

Ese `__name` existe como preámbulo del módulo **en Node**. Al cruzar a la página, el cuerpo de la
función viaja y el helper no: la referencia queda colgando.

Aplica a **cualquier** `const foo = (x) => …` declarado dentro del callback, no solo al helper del
caso. No aplica a la función anónima que se pasa directamente como argumento de `page.evaluate`,
que es la forma que casi todos los ejemplos usan — y por eso el patrón no falla hasta que alguien
extrae un helper para no repetirse.

## Solución

Tres salidas, en orden de preferencia:

1. **Inlinear la lógica** en vez de extraer el helper, aunque se repita.
2. Declarar los helpers con `function foo(x) { … }` en vez de `const foo = (x) => …` — la
   declaración de función no pasa por el envoltorio.
3. Inyectarlos con `page.addScriptTag`, cuyo código vive **como string** y no pasa por el
   transform del archivo `.ts`.

Diagnosticarlo costó tres iteraciones, porque el mensaje no menciona ni `tsx`, ni esbuild, ni
`page.evaluate`.

## Cómo evitarlo

**Dentro de un `page.evaluate`, no hay helpers de módulo: hay una función que se va a serializar.**
Todo lo que el cuerpo referencie tiene que estar dentro del cuerpo o dentro de la página. Si el
error dentro del navegador nombra un identificador que no escribiste (`__name`, `__defProp`,
`__toESM`), la causa es el transform del cargador, no el código, y buscar el identificador en el
propio script no encuentra nada.

Hermano de [E-053](E-053-un-script-suelto-no-es-el-entorno-de-modulos-del-repo.md): allí el script
desechable no hereda el **entorno de módulos** del repo; aquí hereda un **transform** que el
destino no entiende. En los dos casos el mensaje señala al import o al identificador, nunca al
cargador.
