# E-030: Un contrato que se contradice entre su docstring y su ADR

**Área:** build
**Apariciones:** 1 — F-010

## Síntoma

`implementer` y `dev-tester`, que escriben en paralelo **sin verse**, leyeron el mismo símbolo del
contrato y programaron cosas incompatibles. La suite quedó con un rojo que no era culpa de ninguno
de los dos:

```
insertQabOrders > should create every order of the batch, IN ORDER, and count them
  expected "create" to be called 2 times, but got 1
```

## Causa raíz

El contrato decía dos cosas distintas sobre la misma función, en dos sitios distintos:

- El **docstring** de `insertQabOrders`: «crea cada pedido del lote… el lote viene filtrado por
  `selectNewQabOrders` **antes** de llegar aquí» → se lee como *crea sin comprobar nada*.
- El **ADR 0052**, nivel 2 del criterio 4: «invocar `insertQabOrders` **dos veces seguidas** con el
  mismo lote… la segunda invocación devuelve `created: 0`» → **solo** se sostiene si la función
  pre-lee la presencia ella misma; sin pre-lectura la segunda llamada lanza `P2002`.

Cada agente siguió una de las dos lecturas, y las dos eran defendibles. No es un fallo de
comprensión: es que el documento no tenía una única respuesta.

Lo que hace visible el problema es precisamente la **frontera disjunta** del pipeline: si una sola
persona escribiera código y tests, elegiría una lectura y la aplicaría a los dos lados, y la
contradicción quedaría enterrada hasta que alguien confiara en la otra mitad del contrato.

## Solución

Arbitró el `arch-guardian` —no el implementador ni el tester, que no pueden decidir sobre el
contrato que ambos consumen— y **ganó el ADR**: `insertQabOrders` pre-lee. La razón de fondo no era
el test: con la pre-lectura la **idempotencia es una propiedad de la función**, no del
comportamiento de quien la llama, así que un reintento tras un fallo parcial no puede convertirse en
un `P2002` que aborte la transacción entera. El `P2002` se queda como última red.

El docstring se reescribió para decir lo mismo que el ADR, y el coste quedó escrito con su número
(dos `findMany` por página) en vez de descubrirse luego.

## Cómo evitarlo

Un contrato afirma la misma propiedad en dos registros —la prosa de una firma y el criterio
ejecutable de un ADR— y **nada comprueba que coincidan**. Al cerrar un contrato, recorrer cada
símbolo que aparezca en un criterio de verificación y contrastar su descripción con lo que ese
criterio exige poder ejecutar: si el criterio dice «llamarla dos veces devuelve X», la descripción
tiene que sostener X.

Y cuando implementación y tests divergen sobre un mismo símbolo, la pregunta no es cuál de los dos
agentes se equivocó: **es qué dice el contrato, y si dice dos cosas**. Arbitra quien lo escribió.
