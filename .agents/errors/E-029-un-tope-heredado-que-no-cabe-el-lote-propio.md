# E-029: Un tope de respuesta heredado de otro cliente que no le cabe al lote propio

**Área:** api
**Apariciones:** 1 — F-007

## Síntoma

Una página de sincronización de 2000 items se enviaba bien, pero al confirmarla el negocio quedaba
en `outcome: "error"` con `written: 0`, y **la página siguiente nunca se intentaba**. Medido con
bytes reales:

```
n=1249 ->  99 950 bytes (cap=100 000) ok
n=1250 -> 100 030 bytes (cap=100 000) EXCEDE
n=2000 -> 160 030 bytes (cap=100 000) EXCEDE
```

Ninguna pieza fallaba: el cliente devolvía `TRANSPORT:RESPONSE_TOO_LARGE`, que es lo correcto ante
una respuesta que no cabe.

## Causa raíz

El contrato fijó `QAB_AVAILABILITY_BATCH_SIZE = 2_000` y **reutilizó tal cual**
`QAB_HTTP_MAX_RESPONSE_BYTES = 100_000`, el tope de lectura de otro cliente (el de catálogo), sin
comprobar que la confirmación completa de una página del cliente nuevo cupiera dentro. Las dos
constantes eran razonables por separado y **incompatibles juntas**.

Lo grave no era el error, era que **no se recuperaba nunca**: como el orden de la consulta es
determinista (`ORDER BY pt."id"`) y entre corridas no cambia nada, la corrida siguiente reintentaba
exactamente la misma página con el mismo resultado. Estancamiento permanente, no un reintento con
éxito eventual — y alcanzable en el primer sync de cualquier tienda con más de 1250 productos
agotados a la vez, que es un escenario normal, no un borde.

Por qué no lo cazó la suite: los tests eran de calidad (ninguno decorativo), pero **todos sus
fixtures usaban lotes de un puñado de items**. Nada dimensionado por `BATCH_SIZE` se ejercitó
nunca a tamaño real.

## Solución

**Computar el tope desde el tamaño de página**, en vez de elegirlo (ADR 0051):

```ts
QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES = 128;   // presupuesto por entrada
QAB_AVAILABILITY_RESPONSE_ENVELOPE_MAX_BYTES = 1_024;
QAB_AVAILABILITY_MAX_RESPONSE_BYTES = 1_024 + 2_000 * 128;  // derivado
```

`readBoundedBody` gana un segundo parámetro **opcional con defecto**, así que los otros clientes no
cambian de comportamiento. Se descartó bajar el tamaño de página: dejaría en pie la misma trampa
—un tamaño fijo bajo un tope fijo sigue dependiendo de una suposición no escrita sobre el largo de
los ids— y 1249 no es margen, es el borde exacto donde se midió el fallo.

Y la cota del array bajó al schema (`confirmed.max(BATCH_SIZE)`): dejarla viviendo solo en el cap
de bytes repetía el mecanismo del propio defecto —una protección en otro módulo, que el siguiente
lector no ve y el siguiente ajuste desactiva sin enterarse.

## Cómo evitarlo

Al reutilizar la constante de tope de otro cliente, **calcular el peor caso del nuevo tamaño de
página antes de fijarlo**: `BATCH_SIZE × tamaño de una entrada de la respuesta`. Si no cabe, el
tope se deriva del tamaño de página; no se copia.

Y para la suite: **todo símbolo dimensionado por una constante de tamaño de lote se ejercita una
vez con la página llena**. Un fixture de tres items no prueba nada sobre un lote de dos mil. La
aserción que relaciona dos constantes derivadas de las mismas dos constantes es tautológica y no
sustituye a eso: la comprobación que sirve es contra el **generador** real (leer
`prisma/schema.prisma` de disco y medir un id emitido de verdad), porque un literal escrito a mano
en el fixture seguiría en verde justo el día que alguien cambie el generador.
