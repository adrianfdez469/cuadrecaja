# E-072: zod 4 endurece `.uuid()` y un placeholder de toda la vida deja de parsear

**Área:** tests
**Apariciones:** 1 — F-034

## Síntoma

Un test escribe el UUID de relleno que se usa en medio repositorio y el `safeParse` falla:

```
Invalid UUID
```

El valor es el de siempre:

```
"11111111-1111-1111-1111-111111111111"
```

## Causa raíz

**zod 4 valida `.uuid()` contra RFC 4122**, no contra «la forma 8-4-4-4-12». Exige los nibbles de
versión y de variante: el dígito de versión (posición 13) tiene que ser `1`-`8`, y el de variante
(posición 17) tiene que estar en `8`, `9`, `a` o `b`. Un placeholder de todo unos no cumple ninguno
de los dos.

Lo que hace el fallo desconcertante es que **el repositorio está lleno de esos placeholders y
ninguno falla**: se usan para ids que nunca pasan por un `.safeParse` —fixtures de funciones puras,
argumentos de mocks—. El primer test que valida un id contra un schema es el que se lo encuentra.

## Solución

`crypto.randomUUID()` en los tests que sí validan contra un schema con `.uuid()`. Genera un v4
legítimo y no hay que memorizar dónde van los nibbles.

Los placeholders existentes **no hay que ir a cambiarlos**: donde están, no pasan por un schema y
siguen siendo perfectamente válidos como valores opacos.

## Cómo evitarlo

Antes de escribir un id a mano en un test, pregúntate si ese valor **cruza un schema**. Si lo cruza,
`crypto.randomUUID()`. Si no, cualquier cadena sirve y el placeholder legible es mejor.

Regla general de la que esto es un caso: **un valor de relleno que funciona en un sitio no es
transferible a otro con validación**, y el mensaje del validador (`Invalid UUID`) señala al dato,
no a la razón. La misma familia de sorpresa que
[E-003](E-003-literales-bigint-con-target-es2017.md): el runtime endurece algo y el mensaje no dice
qué regla se incumplió.
