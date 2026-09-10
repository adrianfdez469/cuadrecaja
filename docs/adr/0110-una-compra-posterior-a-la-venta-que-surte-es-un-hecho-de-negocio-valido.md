# ADR 0110: Una COMPRA posterior a la venta que surte es un hecho de negocio válido y no se corrige

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-030

## Contexto

Este ADR existe para responder una pregunta que **nadie va a poder deducir del código**, y que por
tanto alguien va a intentar "arreglar" tarde o temprano.

El POS de este proyecto **permite vender sin existencias**: hay un modo explícito para ello en su
barra de herramientas. Cuando una venta hecha sin conexión llega al servidor con un producto que la
tienda no tiene en stock, la ruta de creación la rechaza hasta que exista una `COMPRA` que la
cubra. Esa compra la registra el operador **cuando se da cuenta**, que es siempre *después* de la
venta que abastece.

El orden resultante en el libro de movimientos —venta a las 22:00, compra que la surte a las 09:00
del día siguiente— parece incoherente y **no lo es**: describe con exactitud lo que ocurrió.

El ADR 0109 lo hace más visible: al sellar el movimiento de `VENTA` con la hora efectiva de la
venta, el libro deja de estar ordenado por el instante en que se escribió, y un recorrido por
`fecha` intercala el `VENTA` retrofechado **antes** de la `COMPRA` que lo cubre. Un lector que
recorra la tabla verá una existencia reconstruida en negativo y lo leerá como un fallo.

El humano lo señaló expresamente el 2026-09-09, y de ahí sale el criterio 12 de F-030, que está
escrito para que cualquier "arreglo" espontáneo ponga un test en rojo.

## Decisión

**No se hace nada.** Ni ahora ni en una revisión posterior de este feature. En concreto, queda
prohibido:

- **Reordenar** movimientos por `fecha` al insertarlos, o desplazar la `fecha` de una `COMPRA`
  hacia atrás para que preceda a la venta que abastece.
- **Rechazar o avisar**: ninguna validación —ni en las rutas de venta, ni en `CreateMoviento`, ni
  en `/api/resumen-dia`, ni en el cierre— puede tratar un movimiento de `VENTA` anterior a la
  `COMPRA` que lo cubre como una anomalía.
- **"Corregir" `existenciaAnterior`.** Es el número que la fila tenía en el instante de la
  escritura, no una reconstrucción del histórico; retrofechar el movimiento no lo invalida.
- **Interpretar como error de datos** una existencia negativa obtenida al reconstruir el histórico
  recorriendo la tabla por `fecha`.

Lo que sí existe, y no se confunda con esto: la validación de existencias del **momento de la
venta** (`InsufficientStockError`, el lock de fila y la comprobación previa al descuento) sigue
igual. Lo que este ADR prohíbe es una guarda **sobre el orden temporal de dos filas ya escritas**,
no la que impide dejar el stock en negativo al vender.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Rechazar una `COMPRA` cuya fecha es posterior a una `VENTA` que dependía de ella | Bloquearía el único camino que tiene el operador para sincronizar una venta *offline* de un producto agotado: la venta ya ocurrió físicamente y rechazar la compra no la deshace |
| Retrofechar automáticamente la `COMPRA` a un instante anterior a la venta | Inventa un hecho: escribe que la mercancía entró en un momento en el que no había entrado, y desplaza dinero real de un período a otro |
| Emitir un aviso o una marca de "anomalía" en el resumen | Un aviso sobre un hecho normal se convierte en ruido que el operador aprende a ignorar, y en trabajo para quien intente "resolverlo". Además convierte la excepción en una regla que alguien acabará imponiendo |
| Ordenar el libro por el instante de escritura en vez de por `fecha` | Contradice el ADR 0109, cuyo objetivo es que la `fecha` diga cuándo ocurrió la cosa; y no arregla el orden, solo lo esconde |
| No retrofechar el movimiento de `VENTA` (o sea, no hacer el ADR 0109) | Devuelve la disociación entre la venta y su movimiento a los dos lados de un corte, que es lo que F-030 existe para cerrar |

## Consecuencias

**A favor:**

- El libro de movimientos sigue describiendo lo que pasó, incluido lo que pasó en un orden
  incómodo.
- El flujo de sincronización de una venta *offline* sin existencias —registrar la compra y
  reintentar— sigue funcionando exactamente igual.
- La decisión queda escrita: quien dentro de seis meses vea el orden invertido y se pregunte por
  qué nadie lo ordenó, tiene la respuesta aquí y un test en rojo si la ignora.

**En contra / coste asumido:**

- **Una reconstrucción del histórico recorriendo por `fecha` puede dar existencias negativas
  transitorias.** No se detecta, no se avisa y no se corrige. Cualquier herramienta futura que
  reconstruya stock a partir del libro tiene que asumirlo desde el principio.
- **Es una prohibición sostenida por un test**, no por el compilador ni por un tipo. Si ese test se
  borra o se reescribe, la prohibición desaparece en silencio. Por eso el criterio 12 lo exige
  explícitamente y por eso existe este ADR: el test dice *qué*, este documento dice *por qué*.
- **No hay señal en los datos** que distinga una compra retrasada legítima de un error de captura
  real. Se acepta: distinguirlos exigiría un dato que nadie captura hoy.

**Impacto en seguridad y escalabilidad:**

- **Ninguno.** No se añade ni se quita código: es una decisión de no implementar. No hay consultas
  nuevas, ni superficie nueva, ni cambio en el aislamiento por `negocioId`.
- **Reversión:** no aplica. Lo reversible sería lo contrario —añadir la guarda—, y este ADR existe
  precisamente para que eso no ocurra sin una decisión nueva del humano.
