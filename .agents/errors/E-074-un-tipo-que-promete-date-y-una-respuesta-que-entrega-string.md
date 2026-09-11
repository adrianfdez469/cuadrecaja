# E-074: Un tipo que promete `Date` y una respuesta HTTP que entrega `string`

**Área:** api
**Apariciones:** 1 — F-035

## Síntoma

El detalle de un deudor **con dos o más movimientos** responde 500. Con uno, funciona.

```
TypeError: b.fecha.getTime is not a function
  src/lib/cuentasPorCobrar/panel.ts:330  (buildMovimientoRows)
```

## Causa raíz

Dos mitades, y la peligrosa es la segunda.

**La primera:** `src/services/cuentasPorCobrarService.ts` devolvía `response.data` crudo bajo un
tipo que declara `fecha: Date`. Por el cable llega un **string** ISO. El tipo prometía una cosa y
el valor era otra, y `tsc` no puede verlo: la promesa está en la anotación, no en el dato.

**La segunda, que es la que lo escondió durante tres rondas de verificación:**
**`Array.prototype.sort` no invoca el comparador con 0 o 1 elementos.** Toda cuenta de un solo
movimiento —con lo que se sembró la primera pasada de QA entera, y con lo que estaban escritos los
tests unitarios— **nunca ejecutaba la línea que rompe**. El caso más ordinario del feature quedó
fuera de la cobertura por una propiedad del lenguaje que nadie tiene presente al elegir un fixture.

Lo que además enmascaraba el borde: todos los componentes envuelven en `new Date(...)` antes de
formatear, y eso funciona igual con un string que con un `Date`. El `sort` era el único sitio del
feature que llamaba a un método de `Date` directamente.

**Y el arreglo obvio era el fallo peor.** `deudorDetalleResponseSchema.parse(...)` a secas
—lo que sugerían tanto el informe de QA como el encargo del coordinador— **revienta en todo deudor
que tenga una venta**: `mapVentaToIVenta` rellena `usuario.usuario` con `""` y `usuarioSchema`
exige `.min(1)`. Se detectó ejecutando `ventaSchema.safeParse` sobre lo que produce el mapper,
antes de escribir el arreglo.

## Solución

Parsear en el **borde del servicio**, que es el único punto donde corre `z.coerce.date()`, y no
con un `new Date()` defensivo en el comparador —eso tapa el síntoma y deja el resto de campos de
fecha igual de mal tipados—.

Para el choque con el mapper: `deudorDetalleClientSchema`, **derivado con `.extend()`** del schema
de respuesta (nunca reescrito), donde `venta` es el único campo que pasa sin validar, con el
motivo en su docstring.

## Cómo evitarlo

- **Un tipo que dice `Date` sobre datos que vienen de HTTP es una promesa que nadie cumple.** Si
  la respuesta no pasa por su schema, el tipo es documentación, no una garantía.
- **Al elegir un fixture, cuenta los elementos.** Un array de uno no ejercita ningún comparador,
  ningún `reduce` con acumulador implícito y ninguna comparación entre pares. Es la pregunta de
  [E-008] aplicada al *tamaño* del dato y no solo a su contenido.
- **Cubre el borde, no solo la función pura.** Un test que llama a la función con `Date` bien
  formados —lo natural al construir un fixture a mano— no puede atrapar esto nunca.

**Deuda del repositorio, destapada al arreglar esto y no cerrada:** de ~34 archivos en
`src/services/`, solo **tres** parsean su respuesta (`tiendaOnlineService`, `qabNegocioService` y
`cuentasPorCobrarService`). Los otros ~31 devuelven `response.data` crudo bajo tipos que prometen
`Date`. Hoy no explota porque las pantallas envuelven antes de formatear, pero **cualquier `sort`,
comparador o resta de fechas sobre datos de servicio tiene este mismo fallo latente**.
