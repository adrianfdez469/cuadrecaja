# E-038: Un `P2002` no se puede *recuperar* dentro de una transacción interactiva de Postgres

**Área:** prisma
**Apariciones:** 1 — F-014

## Síntoma

El contrato decía, con estas palabras:

```
A P2002 on that unique index is CAUGHT and treated as "already sold"…
the outcome carries the EXISTING ventaId
```

Se lee como que basta con envolver el `create` en un `try/catch` dentro del `$transaction`. No basta.
Al implementarlo así, el `findFirst` de recuperación y el propio `COMMIT` de la escritura del
`status` fallan con:

```
current transaction is aborted, commands ignored until end of transaction block
```

## Causa raíz

En PostgreSQL, **una violación de restricción aborta la transacción entera**, no solo la sentencia.
La transacción interactiva de Prisma corre sobre **una sola conexión**, así que el `catch` de
JavaScript **atrapa el error pero no revierte el estado del servidor**: la transacción sigue
abortada y todo lo que venga después se ignora, incluido el commit de lo que sí se había escrito
bien.

El descuido estaba redactado de una forma que empeoraba las cosas. El ADR decía que un `P2002`
**no capturado** aborta la transacción — lo que invita exactamente a la lectura equivocada: que
capturarlo basta.

## Solución

**Hacen falta las dos mitades, y ninguna es redundante:**

1. Una **lectura antes de insertar, dentro** de la transacción. Resuelve el reintento **secuencial**
   —el caso real y frecuente— sin violar nada, y es lo que hace que el resultado sea *observable*
   en vez de deducible.
2. El **`catch` del `P2002` fuera del `$transaction`**, con **un** reintento acotado. Resuelve la
   **carrera** real: en la segunda pasada, la lectura del punto 1 ya encuentra la fila y devuelve el
   resultado correcto.

La lectura sola tiene la carrera dentro; el índice solo no deja recuperar el dato.

**El reintento es uno.** El único fallo que puede resolver es «alguien ganó la carrera», y eso se
resuelve a la primera o no era eso.

Verificado en F-014 ejecutando dos `DELIVERED` simultáneos con `Promise.all`, repetido tres veces:
siempre exactamente una `Venta`, un ganador, y el perdedor recibiendo el `ventaId` existente.

## Cómo evitarlo

**Un `@unique` usado como guarda de idempotencia dentro de un `$transaction` necesita una lectura
previa dentro y el `catch` fuera.** La restricción sigue siendo la autoridad; lo que no puede vivir
dentro de la transacción es **la recuperación**.

Va a reaparecer cada vez que alguien use este patrón, que es el idiomático para idempotencia. Y no
se detecta con tests unitarios: solo aparece ejecutando contra Postgres de verdad.
