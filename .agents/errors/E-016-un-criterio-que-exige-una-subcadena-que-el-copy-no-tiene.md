# E-016: Un criterio verificable que exige una subcadena que el copy dictado no contiene

**Área:** ui
**Apariciones:** 1 — F-005 (dos veces en el mismo documento: criterios 43 y 20)

## Síntoma

Un criterio de diseño falla en el navegador aunque la implementación escribió **exactamente** el
copy que el contrato dicta. Las dos veces:

```
Criterio 43: el textContent del diálogo NO debe contener «Agrupar»
   … pero el copy que el mismo documento dicta para ese diálogo usa «Agrupar locales»

Criterio 20: el textContent debe contener «no es una reserva»
   … pero el copy que el mismo documento dicta dice «Es un pronóstico, no una reserva»
```

`"no una reserva"` no contiene `"no es una reserva"`. Dos frases que significan lo mismo y una
subcadena que no coincide.

## Causa raíz

Un contrato de diseño tiene dos partes escritas en momentos distintos: **el copy**, redactado como
prosa, y **el criterio verificable**, redactado después como un `textContent.includes(...)`. Nadie
comprueba que la segunda esté contenida, carácter por carácter, en la primera — se comprueba que
signifiquen lo mismo, que es otra cosa.

El coste no es el fallo en sí, es a quién señala: el implementador escribió lo que estaba dictado,
así que el rechazo apunta a código correcto. La primera vez (criterio 43) el implementador cambió
el copy para satisfacer al criterio, y **esa fue la decisión equivocada**: el criterio era el que
estaba mal, porque el spec exigía advertir que *agrupar* es irreversible, y no se puede advertir de
lo que está prohibido nombrar.

## Solución

Las dos veces, **cede el criterio, no el copy** —el copy es la decisión de producto y el criterio
es solo su comprobación—, y lo corrige el `ui-designer` en su documento; el implementador no
improvisa el arreglo.

Y una vez detectado el patrón, un repaso mecánico en vez de a ojo: extraer **todos** los code spans
de la sección de criterios y buscar cada uno como subcadena literal en el copy que el documento
dicta. En F-005 eso confirmó que no había un tercero escondido, y dejó localizadas las cuatro
señales legítimas: una plantilla `{N}`, una negrita de markdown que el `textContent` concatena
igual, una cita explicativa, y las cadenas que están prohibidas por definición.

## Cómo evitarlo

**Un criterio que exige una subcadena literal se escribe copiando y pegando del copy, nunca
tecleándolo de nuevo.** Reescribirlo de memoria es donde se cuela el «es».

Al cerrar un contrato de diseño, pasar el repaso mecánico: cada subcadena exigida tiene que
aparecer, exacta, en el copy dictado — salvo las prohibidas, que por definición no aparecen, y las
que llevan plantilla o formato, que hay que normalizar antes de comparar.

Y para quien reciba el rechazo: **si el copy que escribiste es literalmente el que el contrato
dicta, no lo cambies para contentar al criterio.** Devuélvelo al `ui-designer`: una de las dos
partes de su documento está mal y solo él sabe cuál.
