# E-068: Un valor concreto que contradice el rango que el mismo documento declara

**Área:** build
**Apariciones:** 1 — F-034

## Síntoma

Ningún mensaje de error. Un contrato de interfaces fijaba, en su §9.1, el valor esperado de una
función de saneado:

```
- `stripControlCharacters` sobre esa misma cadena devuelve `"Anap"` — sin espacios en el hueco
```

…y en su §3.5, tres secciones más arriba, declaraba el rango que esa función implementa:

```
CONTROL_CHARACTERS_PATTERN = /[\x00-\x1F\x7F-\x9F]/
```

El valor es **imposible con ese rango**. La cadena de prueba era la secuencia real de apertura de
cajón de una impresora ESC/POS, `"Ana" + \x1B + "p" + \x00 + \x19 + \xFA`, y su último byte, `\xFA`,
es `U+00FA` — **la letra `ú`**, por encima de `\x9F` y por tanto **fuera** del rango. Sobrevive
exactamente igual que la `é` que el propio §9.1 exigía conservar dos líneas antes. El resultado
correcto es `"Anapú"`.

## Causa raíz

El rango vive en una sección y el valor esperado en otra, y **cada frase es plausible por
separado**. Quien escribe el valor está pensando «se van los bytes del comando», y `\xFA` *es* parte
del comando —es su segundo parámetro de tiempo—, así que la intuición lo mete en el saco de lo que
se va. Pero el saneador no sabe de comandos: sabe de un rango.

Es la forma inversa de [E-039](E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md). Allí
el contrato **parafraseaba con palabras** una definición que ya existía y perdía sus casos borde;
aquí el contrato **la declara bien** y luego escribe a mano un valor concreto que no se sigue de
ella. En los dos casos la definición real y su reflejo en prosa se separan sin que nada falle.

## Solución

Corregir el valor a `"Anapú"` **y no el rango**: ampliarlo hasta `\xFA` se comería las tildes y
rompería el catálogo de nombres. El contrato dejó escrita, junto al valor, la lista cerrada de lo
que sí se va —`\x1B`, `\x00` y `\x19`, y solo esos— y por qué el cuarto byte sobrevive, para que
nadie lo «arregle» en la dirección contraria.

## Cómo evitarlo

Lo que hace esta ficha vale la pena no es el error, es **cómo apareció**:

> El `implementer` y el `dev-tester`, que trabajan en paralelo y **no se ven**, convergieron los dos
> en `"Anapú"` por su cuenta, y **cada uno lo detectó ejecutando, no leyendo**.

El `dev-tester` copió la expectativa mala del documento y la corrigió al correrla. El `implementer`
la cazó con un script de auto-chequeo y dejó dicho que sin ese script habría entregado una
implementación correcta **contra un test que la rechaza**. Ninguna revisión lo habría visto: las dos
frases están en secciones distintas y las dos son razonables.

Regla accionable, para quien escriba un contrato: **un valor concreto de ejemplo es código, no
prosa — ejecútalo antes de escribirlo.** Si el contrato declara un rango, una regex o un umbral, el
ejemplo que lo ilustra se calcula con esa definición, no con la intuición de lo que la definición
debería hacer. Y para quien implementa: un script de auto-chequeo que reproduzca los valores fijados
del contrato **antes** de entregar cuesta minutos y es lo único que separa este caso de un rechazo
de QA sobre código correcto.
