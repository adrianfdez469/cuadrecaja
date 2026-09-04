# E-016: Un criterio verificable que exige una subcadena que el copy dictado no contiene

**Área:** ui
**Apariciones:** 2 — F-005 (dos veces en el mismo documento: criterios 43 y 20) · F-020 (criterio 23)

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

---

## Reaparición en F-020 — el criterio 23, y lo que la cazó

Mismo patrón exacto, en un criterio **heredado**: el 23 de F-005, diferido a F-020, exigía del banner
de campos vacíos la subcadena

```
se va a borrar de tu tienda online
```

«en la ayuda del campo **y en la cabecera de recuento**». La ayuda del campo la contiene; el banner
dice `se **van** a borrar`, porque habla de N campos. Un plural contra un singular.

**Lo cazó el repaso mecánico que esta ficha recomienda**, aplicado por el `ui-designer` sobre su
propio documento antes de entregarlo: extraer los code spans de la sección de criterios y buscarlos
como subcadena literal en el copy dictado. Es la primera vez que este error se detecta antes de
costar un rechazo, y confirma que el repaso funciona.

**La corrección fue partir el criterio en dos** (uno para el campo, otro para el banner), no tocar
ninguno de los dos copys. La regla del final de esta ficha se sostuvo: el copy era el dictado y el
equivocado era el criterio.

Dos cosas que esta aparición añade:

- **El plural es un generador de este error.** Un copy que cuenta cosas tiene dos formas, y un
  criterio escrito de memoria elige una. Al exigir una subcadena de una frase con recuento, hay que
  comprobar contra **todas** sus ramas — y si el copy no tiene la rama que hace falta, eso es un
  hallazgo, no un detalle: en F-020 fue así como se descubrió que el banner **no tenía forma
  singular** y decía «1 datos están vacíos».
- **Un criterio heredado de otro feature es el más expuesto**, porque se cita por número y se
  ejecuta sin releer el copy al que apunta. Ver
  [E-018](E-018-la-redaccion-congelada-de-un-criterio-diferido.md).
