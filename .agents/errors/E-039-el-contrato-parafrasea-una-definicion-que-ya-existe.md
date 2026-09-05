# E-039: El contrato parafrasea con sus palabras una definición que ya existe en el código o en el motor

**Área:** build
**Apariciones:** 1 — F-014 (tres veces en el mismo feature)

## Síntoma

Tres desviaciones del contrato en un solo feature, sin nada en común a primera vista:

1. «Un `P2002`… es capturado» — pero el motor no lo permite ahí ([E-038](E-038-el-p2002-no-se-recupera-dentro-de-la-transaccion.md)).
2. «No hay `TasaCambio` para la moneda del pedido y no es la base» — regla que **bloquea todo pedido
   en la moneda base**, porque el ancla nunca tiene fila de tasa.
3. «Se lee en paralelo con lo que la ruta ya lee» — imposible: el `tiendaId` sale de la fila del
   pedido, así que la lectura es forzosamente posterior.

Ninguna daba error al escribirse. Las tres se detectaron **al implementarlas**.

## Causa raíz

Las tres tienen **la misma forma**: son los tres sitios donde el contrato **describió con sus
propias palabras** algo que el motor o el código **ya definían**.

- El comportamiento transaccional de Postgres.
- `missingRateCodes` (`src/lib/currency.ts:152`), que es la definición única del proyecto de «las
  tasas que una venta necesita» — y cuyo comentario dice explícitamente que sirve para **omitir la
  `monedaBase` del negocio**.
- El orden que impone una dependencia de datos.

Una paráfrasis parece inocua porque *suena* igual. Pero la definición real tiene casos borde que la
paráfrasis no hereda, y quien la lee después programa contra la paráfrasis, no contra la fuente.

La regla, tal como la escribió el arquitecto al verlas juntas:

> **El contrato acierta cuando *nombra* la definición existente, y falla cuando la reescribe.**

## Solución

Sustituir cada paráfrasis por una **cita**: el contrato nombra `missingRateCodes` en vez de
describir su comportamiento; nombra el modo de fallo real del motor; y dice «secuencial, porque el
`tiendaId` sale de la fila» en vez de «en paralelo».

## Cómo evitarlo

**Al escribir un contrato:** si una frase *explica* un mecanismo ajeno —el motor, una función de
`src/lib/`, un orden impuesto por los datos— en vez de *citarlo*, abre la fuente real y comprueba
que dicen lo mismo. Si no puedes citarla, es señal de que no la has leído.

**Al implementar:** cuando el contrato explique un mecanismo ajeno en vez de nombrarlo, **abre la
fuente antes de obedecer**. Si no coincide, implementa lo correcto y **decláralo como desviación**;
no obedezcas la paráfrasis y no la arregles por tu cuenta. En F-014 las tres desviaciones acabaron
en enmienda del contrato, así que el `qa` verificó contra un documento que decía lo que el código
hacía — que es justo lo que evita [E-030](E-030-un-contrato-que-se-contradice-entre-su-docstring-y-su-adr.md).

**Relación con [E-014](E-014-una-senal-derivada-cuya-definicion-se-parafrasea.md):** aquel es el
mismo error dentro del código —una señal derivada cuya definición se parafrasea en ocho sitios—.
Esta ficha lo generaliza al contrato, donde el daño es mayor: la paráfrasis se convierte en
especificación y el `qa` la lee como tal.
