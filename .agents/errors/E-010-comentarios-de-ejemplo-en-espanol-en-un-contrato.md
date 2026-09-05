# E-010: Un comentario de ejemplo en español dentro de un contrato acaba en el código real

**Área:** build
**Apariciones:** 2 — F-004 (dos veces dentro del mismo feature), F-010

## Síntoma

Código nuevo con comentarios en español, que `AGENTS.md` § Convenciones prohíbe expresamente:

```ts
const negocioId = session.user.negocio.id; // la ÚNICA fuente de negocioId
internal: "TIENDA_ONLINE_UNAVAILABLE",     // único cuerpo de todo 500 del módulo
```

Nada falla: `tsc` da exit 0, `lint` no emite ni una advertencia, y los 1225 tests pasan. La
convención no está automatizada, así que el único filtro es que alguien lo lea.

## Causa raíz

Los comentarios **no los escribió el implementador**: venían copiados literalmente de los bloques
de código del contrato de interfaces (`.agents/specs/F-004.md`, §1 y §4), donde el arquitecto los
había escrito en español al redactar la especificación en español.

Y ahí está la causa de verdad: **un bloque de código dentro de un contrato no se lee como prosa
ilustrativa, se lee como plantilla**. El implementador hace exactamente lo que se le pide —
programar contra el contrato— y al copiar la firma se lleva el comentario pegado. El prosa del
contrato va en español por convención del proyecto; sus bloques de código, no, porque **son código**.

El §4 era el peor de los dos: es el *snippet canónico del handler*, el bloque que se copia en cada
ruta nueva del módulo. Ahí el comentario no se propaga una vez, se propaga por cada ruta que
alguien escriba, en este feature y en los que hereden el módulo.

## Solución

Traducidos los cuatro comentarios en el código real y **los dos del contrato**, que era lo que de
verdad cerraba el ciclo:

```
// la ÚNICA fuente de negocioId      → // the ONLY source of negocioId
// único cuerpo de todo 500 del módulo → // the ONLY body of every 500 of the module
```

Arreglar solo el código habría dejado la fuente intacta: F-005 y F-011 consumen ese mismo contrato
y habrían reintroducido el comentario sin hacer nada malo.

## Cómo evitarlo

**En un contrato, la prosa va en español y los bloques de código van en inglés**, comentarios y
JSDoc incluidos. Son código: se copian, no se leen.

Aplicable a quien escribe un contrato (`arch-guardian`) y a quien lo revisa antes del paso 5. Un
`grep` de caracteres acentuados sobre las líneas de comentario de los bloques `ts`/`tsx` del
contrato lo caza antes de que llegue a `src/`:

```bash
grep -nE '^\s*(//|\*).*[áéíóúñÁÉÍÓÚÑ¿¡]' .agents/specs/F-###.md
```

Y la regla general que este error hace concreta: **cuando algo aparece mal en el código, comprobar
si venía mal del artefacto del que se copió.** Arreglar la copia y no el original garantiza que
vuelva.

---

## Reaparición en F-010 (2026-09-05)

Segunda aparición, con una variante que conviene conocer: esta vez **el comentario no estaba en
español, estaba en inglés y era correcto** — explicaba por qué `readQabOrderCursor` no debe proyectar
la columna del token, **nombrándola**.

El problema es que el propio contrato mandaba una comprobación ejecutable que lee
`src/lib/qab/qabOrderWrite.ts` **entero, comentarios incluidos**, y verifica que esa cadena no
aparezca. Copiar el bloque del contrato tal cual habría hecho fallar la comprobación que ese mismo
contrato exige.

Lo esquivó el `implementer`, que reescribió el comentario sin nombrar la columna, y el
`arch-guardian` corrigió después el bloque del contrato.

**Lo que añade esta aparición:** no basta con vigilar el idioma de un comentario de contrato. Un
bloque de código de un contrato es una **plantilla que se copia literalmente**, así que tiene que
cumplir todas las reglas que el propio contrato impone al archivo resultante — incluidas las que se
comprueban sobre el texto del archivo, comentarios incluidos.
