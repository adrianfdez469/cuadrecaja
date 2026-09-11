# E-066: Simular un fallo de red no ejercita el manejo de errores — lo reintenta el interceptor

**Área:** tests
**Apariciones:** 1 — F-034 (QA)

## Síntoma

Para verificar que una venta que **falla una vez** queda guardada con un intento fallido, se
provocó un `ERR_NETWORK` en la petición de creación. La venta **se sincronizó igualmente**, el
contador quedó en `0`, y el `catch` de la pantalla **nunca llegó a ejecutarse**.

Parece que el código de manejo de fallos no funciona. Funciona: es que no se le llamó.

## Causa raíz

`src/lib/axiosClient.ts` tiene un **interceptor de reintentos** que, para las peticiones que llevan
cabecera de idempotencia —y `createSell` la lleva—, reintenta de forma transparente cualquier
`ECONNABORTED` o `ERR_NETWORK` **hasta dos veces antes de que la promesa llegue al código de
aplicación**.

O sea: el error de red se resuelve **por debajo** del `catch` que se quería probar. La segunda o la
tercera petición tiene éxito, y desde arriba no ocurrió nada.

Un segundo mecanismo agrava la confusión: una venta pendiente sembrada en `localStorage` con un
`productoTiendaId` **real** se auto-sincroniza en un par de segundos, por el efecto de resincronizado
automático del POS, antes incluso de poder mirarla.

## Solución

- Para que la clasificación de fallos se ejercite de verdad, **fabricar un `500`** en la capa de
  transporte, no un error de red: un 500 no es reintentable por el interceptor y sí llega al
  `catch`.
- Para que una venta pendiente **siga pendiente** mientras se la inspecciona, sembrarla con un
  `productoTiendaId` **inexistente**, de modo que el servidor la rechace de verdad.

## Cómo evitarlo

**Antes de simular un fallo, mira quién más lo va a ver antes que tú.** Un interceptor, un
reintento automático o una cola pueden absorber exactamente la condición que se quería provocar, y
el resultado —«no falló»— es indistinguible de «el código maneja bien el fallo».

Regla corta: **el fallo que se inyecta tiene que ser de una clase que nadie reintente**. Si no se
sabe cuál es, se lee el interceptor primero.

Es primo de [[E-056]] —forzar un error con un plazo es una carrera que se puede perder— y de
[[E-008]]: en los dos casos la verificación pasa sin haber probado nada.
