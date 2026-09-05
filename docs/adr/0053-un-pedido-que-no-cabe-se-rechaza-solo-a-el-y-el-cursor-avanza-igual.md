# ADR 0053: Un pedido que no cabe se rechaza solo a él, y el cursor avanza igual

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-010

## Contexto

`qabAmountSchema` normaliza un importe del cable a una cadena de escala fija, pero **no acota su
magnitud**. Comprobado ejecutando al cerrar F-001: `qabAmountSchema(1e20)` devuelve
`"100000000000000000000.00"`, y ese literal produce `numeric field overflow` en Postgres contra un
`Decimal(14, 2)`. F-001 no escribía en la base y por eso no incumplía nada. **F-010 es el feature que
hace el `create`**, así que ese importe llega hasta el `INSERT`.

El modo de falla, si no se hace nada, es el peor de los posibles: el `create` de **un** pedido lanza
dentro de la transacción interactiva del lock, la transacción entera se aborta, **ningún** pedido del
lote queda escrito, el cursor no avanza, y la corrida siguiente vuelve a pedir exactamente la misma
página con exactamente el mismo resultado. Estancamiento permanente por un solo pedido malo — el
mismo mecanismo de [E-029], por otro camino.

El mismo razonamiento aplica a todo lo que **no podemos representar**: una cantidad fuera del rango
de `Decimal(14, 3)`, un pedido cuya forma no satisface el schema, uno con más líneas de las que
aceptamos, uno con un texto libre desproporcionado. Todos comparten la propiedad de que **nada
cambia entre corridas**: reintentarlos falla igual para siempre.

Y hay una tensión real detrás: rechazar un pedido es **perder un pedido de verdad de un comerciante
de verdad**.

## Decisión

**La magnitud se acota en el borde, el rechazo es por pedido, y el cursor avanza igual.**

Tres piezas, en ese orden:

1. **Se acota en el borde, no en la base.** Dos predicados puros nuevos en `src/schemas/qabAmount.ts`
   —`fitsQabAmountColumn` y `fitsQabQuantityColumn`— comprueban que el número de dígitos enteros del
   valor ya normalizado cabe en `Decimal(14, 2)` y `Decimal(14, 3)` respectivamente. Se comprueban
   **antes** de construir la fila, nunca dejando que lo diga Postgres. Viven en `qabAmount.ts` porque
   son propiedades del helper que produjo la cadena, no del pull.

2. **El rechazo es por pedido y nunca escala.** Un pedido que no pasa cualquiera de las validaciones
   de representabilidad no se escribe, se cuenta en `rejected`, se registra en un log con su
   `qabOrderId` y un código de un vocabulario cerrado, y **los demás pedidos de la misma página se
   escriben normalmente**. No hay ninguna ruta por la que un pedido rechazado lance una excepción
   dentro de la transacción del pull. Ese es el criterio 10 completo, sus tres letras.

3. **El cursor avanza por encima de un pedido rechazado.** `qabUltimoPedidoVisto` se lleva al mayor
   id **recibido**, incluidos los rechazados, y no al mayor id escrito.

El punto 3 es la parte que duele y es una decisión, no un descuido: **un pedido rechazado se pierde
para el pull incremental.** Se elige así porque la alternativa —no avanzar— bloquea *todos* los
pedidos futuros de ese negocio detrás de uno que nunca va a poder escribirse, y sacrificar el flujo
entero de un negocio para conservar un pedido irrepresentable es estrictamente peor. Además:

- del lado de QAB el pedido ya quedó marcado como `PULLED`, así que no reaparece por sí solo;
- **no es irrecuperable**: F-017 añade las lecturas laterales (`?ids=`, `?status=`) sobre el mismo
  endpoint, que ignoran el cursor por completo y pueden volver a leerlo;
- la pérdida es **visible**: `rejected > 0` en el informe de la corrida y una línea de log por pedido
  con su `qabOrderId` y su motivo.

### La otra mitad del cursor: `nextCursor` avanza sobre la palabra del tercero

`advanceQabOrderCursor` pliega `maxQabOrderId` sobre el cursor vigente, los ids recibidos **y
`nextCursor` cuando no es nulo**. Ese último sumando entra **verbatim del tercero**, sin cotejarlo
contra el máximo de los ids realmente entregados, y es deliberado: es lo que permite saltar los
huecos del `BIGINT` global sin tratarlos como pedidos perdidos (criterio 5), y es coherente con que
QAB sea la autoridad de sus propios datos.

Pero deja una **asimetría que hay que decir en voz alta**, porque no es un efecto colateral de la
fórmula: un pedido rechazado queda **visible** —`rejected > 0` y una línea de log con su
`qabOrderId`—, mientras que un `nextCursor` corrupto, adelantado por un bug del emisor o forjado por
un `QAB_API_BASE_URL` mal apuntado, adelantaría el cursor **por encima de pedidos legítimos que nunca
se nos entregaron**, con la misma vía de recuperación (F-017) y, tal como estaba escrito,
**sin ningún rastro** en el informe ni en el log.

**El comportamiento no cambia** —cotejar `nextCursor` contra el máximo entregado rompería el salto de
huecos, que es un invariante declarado del contrato—, pero deja de ser invisible:
`advanceQabOrderCursor` devuelve además `jumped`, cierto cuando `nextCursor` es estrictamente mayor
que **todos** los ids de esa página, y el pull publica un contador `cursorJumps` en su informe y en su
línea de log. Un salto es normal y frecuente —cada negocio ve la secuencia global con huecos—, así
que el contador no es una alarma: es lo que hace que la pregunta «¿por qué se saltó del 40 al 7000?»
tenga dónde mirarse en vez de no existir.

### Lo que NO se rechaza

Ser liberal en lo que se acepta es parte de la decisión, porque cada validación de más es un pedido
real perdido de más:

- **Un `status` o un `cancelledBy` desconocidos no se rechazan.** Se guardan como texto libre, con
  los schemas tolerantes que F-001 ya dejó. El enum ya creció de 6 a 9 valores sin periodo de
  convivencia y sin ningún error HTTP que avisara (ADR 0004).
- **Un `code` que no cumple el alfabeto Crockford del contrato no se rechaza.** Se guarda como texto
  opaco, acotado en longitud. Perder un pedido por un endurecimiento de formato del emisor sería un
  coste absurdo.
- **Un importe negativo no se rechaza.** El contrato no emite ninguno, pero acotar el signo no
  protege de nada que la magnitud no cubra ya, y prohibirlo es superficie de rechazo gratuita.
- **Una desigualdad entre los importes no rechaza el pedido.** Con `deliveryFeePending: false` se
  espera `total = subtotal - discountTotal + deliveryFee`, y con `true`,
  `total = subtotal - discountTotal`. Los importes son autoridad de QAB, no nuestra: si nuestra
  aritmética discrepa, se persiste el pedido tal cual y se cuenta en `inconsistentTotals`. Negarse a
  guardar un pedido porque nuestra suma no cuadra sería perder una venta por una discrepancia de
  céntimos.
- **Un `storeExternalId` que no resuelve a una tienda propia no rechaza nada.** `tiendaId` queda
  `null`, tal como el modelo de F-001 ya decidió.
- **Un `customerWhatsappUrl` que no empieza por `https://` no rechaza el pedido**: se guarda `null`.
  Es un campo de conveniencia y descartarlo no cuesta nada, mientras que guardar una URL de esquema
  arbitrario que F-011 va a pintar como enlace sí cuesta.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dejar que lo rechace Postgres y capturar el error | Dentro de una transacción interactiva el error aborta la transacción entera: se pierde el lote completo y el cursor no avanza. Es exactamente el modo de falla que este ADR existe para eliminar |
| Truncar el importe al máximo del `Decimal` | Guardar un pedido con un total distinto del que el cliente vio es peor que no guardarlo: pasa la validación, no da error, y produce un cobro incorrecto en silencio. Es la misma familia de defecto que la trampa de `deliveryFeePending` |
| No avanzar el cursor por encima de un rechazado | Bloquea todos los pedidos posteriores de ese negocio, para siempre y sin recuperación automática. Un pedido perdido y visible es mejor que un negocio entero parado |
| Guardar el pedido rechazado en una tabla de cuarentena | Columna y modelo nuevos para un caso que el contrato no produce hoy. F-017 ya da la vía de recuperación con las lecturas laterales, y el `qabOrderId` del log es todo lo que hace falta para usarla |
| Rechazar también los `status` desconocidos | Contradice el criterio 6 y repite el fallo de la transición de 6 a 9 valores, donde el error fue enteramente del lado de cuadrecaja |

## Consecuencias

**A favor:**

- Un dato absurdo del cable no puede tumbar el pull de su negocio ni el de ningún otro.
- El criterio 10 queda verificable en sus tres letras con un solo montaje: una respuesta con un
  pedido de importe desbordado y otros dos válidos.
- La superficie de rechazo es pequeña y está enumerada: solo lo que no podemos representar.

**En contra / coste asumido:**

- **Un pedido rechazado se pierde del pull incremental.** Recuperable solo con las lecturas
  laterales de F-017 o a mano.
- `inconsistentTotals` y `cursorJumps` son contadores que hoy nadie mira: no hay pantalla ni alerta
  que los consuma. Son información del informe de la corrida y de nada más, hasta que F-011 decida si
  los muestra. `cursorJumps`, además, es alto por diseño —los huecos son la norma—, así que no sirve
  como señal por sí solo: sirve cuando ya se está investigando un pedido que no llegó.
- **El cursor sigue avanzando sobre la palabra del tercero.** La traza lo hace investigable, no lo
  hace imposible.
- Los topes de longitud y de líneas son **nuestros**, no del contrato. Si QAB emitiera legítimamente
  un pedido por encima de uno de ellos, lo perderíamos, y el aviso sería un `rejected` en el informe.
  Están fijados muy por encima de cualquier pedido real por ese motivo.

**Impacto en seguridad y escalabilidad:**

- Los topes de texto, de líneas y de tamaño de `rateSnapshot` impiden que un tercero —o un
  `QAB_API_BASE_URL` mal apuntado— escriba texto sin acotar en nuestra base, que es texto que F-011
  va a pintar en una pantalla.
- Descartar un `customerWhatsappUrl` que no es `https://` cierra en el borde un enlace de esquema
  arbitrario, en vez de confiar en que cada pantalla futura lo sanee.
- El coste por pedido rechazado es constante: una comprobación pura y una línea de log. Nada recorre
  el histórico.

[E-029]: ../../.agents/errors/E-029-un-tope-heredado-que-no-cabe-el-lote-propio.md
