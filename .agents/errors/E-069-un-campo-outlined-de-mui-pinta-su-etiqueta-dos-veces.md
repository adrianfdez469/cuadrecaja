# E-069: Un campo outlined de MUI pinta su etiqueta dos veces

**Área:** ui
**Apariciones:** 1 — F-033

## Síntoma

Un criterio de diseño que cuenta un texto en pantalla obtiene **el doble** de lo que se ve:

```
criterio 18: ownTextEquals(PANEL, "Tramo de antigüedad") → 2   (esperado: 1)
```

No hay dos etiquetas en la pantalla. Hay una, y el DOM la contiene dos veces.

## Causa raíz

Todo campo `outlined` de MUI escribe su etiqueta **dos veces**, verificado en
`@mui/material/OutlinedInput/NotchedOutline.js:116-120`: una en el `<label>` visible y otra en el
`<span>` que va dentro del `<legend>` del `NotchedOutline`, que es lo que abre el hueco en el
borde para que la etiqueta flote sobre él. El segundo es invisible por CSS pero está en el DOM y
lo devuelve cualquier búsqueda por texto.

Lo que lo hizo difícil de ver es que el defecto nació **de dos criterios del mismo documento, los
dos escritos con cuidado**: el criterio 13 exigía que el `Select` fuera `outlined` —correcto, es
el estándar del proyecto— y el 18 contaba su etiqueta esperando 1. Cada uno por separado es
razonable; juntos son incumplibles, y ninguna revisión por lectura lo detecta.

**No es [E-011].** Allí se mide el *contenedor equivocado*: se busca una cosa y se encuentra otra.
Aquí el elemento encontrado **es** literalmente el texto buscado, dos veces, y **las dos
apariciones son correctas**.

**No es [E-016].** Allí la subcadena *no existe*, o la pinta otro feature en la misma ruta. Aquí
la pinta **el mismo campo, por duplicado**, por un detalle de implementación de MUI que no se ve
en pantalla.

## Solución

Contar exigiendo también el `tagName`, no solo el texto:

```ts
// ownTextEqualsTag(root, text, tag) — the tag is what separates the visible <label>
// from the <span> that MUI hides inside the <legend> of every outlined field.
ownTextEqualsTag(PANEL, "Tramo de antigüedad", "LABEL")   // 1
ownTextEqualsTag(PANEL, "Tramo de antigüedad", "TH")      // 0
```

La tabla del criterio corregido enumera los textos **por etiqueta y con los ceros incluidos**: sin
las filas que valen 0, un `<th>` titulado igual que un campo pasaría el criterio sin que nadie lo
notase.

## Cómo evitarlo

**Un criterio que cuenta texto sobre un formulario de MUI cuenta el doble de lo que se ve.**
Exige el `tagName`, y escribe la tabla con los ceros.

Y la regla general de la que este error es un caso: **un localizador dentro de un contrato de
diseño es especificación ejecutable**. Verifícalo contra el DOM real —o contra el código del
componente en `node_modules`— antes de escribirlo. Razonar sobre cómo *debería* estar construido
un componente compartido es exactamente lo que produce un criterio que rechaza código correcto.
