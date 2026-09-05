# E-022: Los clicks por coordenada fallan en silencio si la captura viene reescalada

**Área:** ui
**Apariciones:** 1 — F-020 (verificación en navegador del `qa`)

## Síntoma

Un click sobre un elemento que se ve perfectamente en la captura **no hace nada**. Sin error, sin
mensaje: el click ocurre, pero en otro sitio. Se manifestó en un formulario de login y en un `Select`
de MUI, que son justo los sitios donde un click perdido parece un problema de la aplicación.

En esa sesión la captura medía 1559×784 y el viewport real 2560×1288: **las coordenadas de la
captura no son las del viewport.**

## Causa raíz

La herramienta de control del navegador devuelve la captura reescalada, y las coordenadas que se leen
de ella se envían sin reconvertir. El factor de escala depende del viewport de cada sesión, así que
el mismo script funciona un día y falla al siguiente sin que nada del código haya cambiado.

## Cómo evitarlo

**No dirijas una interacción por coordenadas leídas de una captura.** Usa el DOM: dispara eventos
nativos con la herramienta de JavaScript y localiza el elemento por selector, no por posición.

Para un `Select` de MUI en concreto, un click por coordenada es especialmente frágil: el menú se
monta en un portal fuera del contenedor, así que la posición visible del elemento y la del nodo que
recibe el evento no tienen por qué coincidir.

Y si aun así hace falta un click por coordenada, **compara las dimensiones de la captura con
`window.innerWidth`/`innerHeight` antes de enviarlo**. Si no coinciden, hay que escalar. Es hermano
de [E-005](E-005-resize-window-no-cambia-el-viewport.md): la verificación en navegador miente cuando
se confía en un número que la herramienta transformó por su cuenta.
