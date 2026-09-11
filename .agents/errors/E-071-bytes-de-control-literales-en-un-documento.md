# E-071: Bytes de control literales en un documento rompen `grep` y sobreviven a un `Edit`

**Área:** build
**Apariciones:** 1 — F-034

## Síntoma

Un contrato de diseño tenía que especificar una secuencia de ataque ESC/POS para un criterio de
verificación. Escrita **literal** —aunque fuera dentro de comillas, dentro de un bloque de código—
el archivo queda con bytes `\x00`, `\x1B` y `\x19` de verdad dentro:

- `grep` deja de comportarse: trata el archivo como binario, o casa líneas que no se ven.
- Una edición por herramienta **no los quita**: el `old_string` que se teclea no contiene los bytes
  reales, así que no hace match; y si hace match parcial, el byte se queda.
- El documento se ve perfectamente normal en pantalla.

## Causa raíz

Un documento que **describe** una secuencia de control no puede **contenerla**. La distinción entre
«el texto que representa el byte» y «el byte» desaparece en cuanto se pega el valor real, y a partir
de ahí las herramientas de texto trabajan sobre un archivo que ya no es texto.

Lo mismo vale para un test: `.agents/` y `src/__tests__/` se recorren con `grep` constantemente —el
barrido de rutas de máquina, el censo de rutas, las búsquedas de copy—, y un byte de control
enterrado los envenena a todos en silencio.

## Solución

Escribir siempre la secuencia con **escapes** (`\x1B`, `\x00`), y construirla en tiempo de ejecución
donde haga falta el byte de verdad:

```
const KICK_SEQUENCE = "Ana\x1Bp\x00\x19\xFA";
```

En F-034 el bloque afectado hubo que reescribirlo generándolo desde Python, porque una edición
normal ya no podía tocarlo.

## Cómo evitarlo

**Un contrato que especifica una secuencia de control no la escribe literal, ni siquiera dentro de
comillas.** Vale para los documentos de `.agents/`, para los ADR y para los tests.

Y un aviso de la misma familia, encontrado en F-034 al verificar: **`\x00` en un campo de texto lo
rechaza Postgres por su cuenta**, con `invalid byte sequence for encoding "UTF8"`, antes de que
llegue ninguna validación de la aplicación. Si necesitas provocar el «antes» de un fix de saneado
contra la base de datos, usa una variante **sin** `\x00` (por ejemplo `\x01`), o estarás midiendo la
defensa del motor y no la tuya.
