# ADR 0051: El tope de respuesta de disponibilidad se computa desde el tamaño de página

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-007

## Contexto

El contrato de interfaces de F-007 fijó dos constantes **por separado**, sin que nadie comprobara que
podían convivir:

- `QAB_AVAILABILITY_BATCH_SIZE = 2_000` — items por petición, el tope del contrato de QAB.
- `QAB_HTTP_MAX_RESPONSE_BYTES = 100_000` — el tope de respuesta de F-002, **reutilizado tal cual**
  por el cliente de disponibilidad.

La respuesta de `POST /api/internal/sync/availability` es `{ applied, confirmed }`, y `confirmed`
son pares `["<ProductoTienda.id>","<Tienda.id>"]`. Con ids uuid, cada entrada mide 80 bytes. Medido
con bytes reales sobre la base de desarrollo:

```
n=1249 ->  99 950 bytes  (cap=100 000)  ok
n=1250 -> 100 030 bytes  (cap=100 000)  EXCEDE
n=2000 -> 160 030 bytes  (cap=100 000)  EXCEDE
```

Es decir: **una página que QAB confirma por encima de ~1250 items produce siempre una respuesta que
el propio cliente rechaza.** `readBoundedBody` y `postQabAvailabilityBatch` se comportan
correctamente —devuelven `TRANSPORT:RESPONSE_TOO_LARGE`—, y el sistema aun así no funciona. El
defecto está en la combinación, no en ninguna de las dos piezas.

**Lo grave no es el error, es que no se recupera.** El orden de la consulta de divergencia es
determinista (`ORDER BY pt."id"`) y entre corridas no cambia nada: la corrida siguiente reintenta
exactamente la misma página con exactamente el mismo resultado. `outcome: "error"`, `written: 0`, la
página 2 nunca se intenta. **Estancamiento permanente**, y con él se cae la propiedad de «converge
sola» sobre la que se sostienen los criterios 4, 5, 6 y 10 y los ADR 0049 y 0050.

No es un caso de laboratorio: se alcanza en el **primer sync de cualquier tienda con más de 1250
productos agotados a la vez**, que es justo el arranque que el ADR 0049 describe como normal.
Reproducido dos veces con datos distintos (2010 filas divergentes puras, y 2010 entre 10 010 filas).

Y llegó vivo hasta QA con 136 tests en verde y ninguno decorativo, porque **todos los fixtures usaban
lotes de un puñado de items**: ninguno se acercaba a 1250 confirmaciones.

## Decisión

**El cliente de disponibilidad tiene su propio tope de respuesta, y ese tope no se elige: se
computa desde el tamaño de página.**

```ts
export const QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES = 128;
export const QAB_AVAILABILITY_RESPONSE_ENVELOPE_MAX_BYTES = 1_024;

export const QAB_AVAILABILITY_MAX_RESPONSE_BYTES =
  QAB_AVAILABILITY_RESPONSE_ENVELOPE_MAX_BYTES +
  QAB_AVAILABILITY_BATCH_SIZE * QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES;
```

`QAB_AVAILABILITY_BATCH_SIZE` **se queda en 2000**, y el tope resultante es 257 024 bytes (≈ 251 KiB).

Tres decisiones dentro de la decisión:

**1. Un tope propio, no el de F-002.** Los 100 000 bytes de `QAB_HTTP_MAX_RESPONSE_BYTES` acotan una
respuesta cuyo tamaño **no determinamos nosotros**: el 207 del catálogo puede traer lo que QAB
quiera. Aquí la respuesta bien formada está acotada por la página que acabamos de enviar, así que el
número correcto es una función de esa página y no una constante prestada de otro cliente. El ADR 0026
ya estableció que los clientes hacia QAB son módulos separados; esto es la misma frontera aplicada a
su límite de lectura. `QAB_HTTP_MAX_RESPONSE_BYTES` no cambia de valor y sigue siendo el defecto de
`readBoundedBody` para catálogo y aprovisionamiento.

**2. Computado, no elegido.** Es lo que hace que el defecto no pueda repetirse. Con dos números
sueltos, cambiar uno sin mirar el otro es cuestión de tiempo — y ya ocurrió. Con el tope derivado, el
error deja de ser posible por construcción, y el presupuesto por entrada queda **escrito y
comprobable** en vez de ser una suposición tácita sobre el largo de los ids.

**3. La página se queda en 2000, no baja.** Bajarla también cabría bajo el cap actual, pero deja la
misma trampa en pie: un tamaño de página fijo bajo un tope fijo sigue dependiendo de una suposición
no escrita sobre el largo de los ids —con ids de 60 caracteres, 1000 items ya no caben en 100 000
bytes—, que es exactamente la clase de defecto que se acaba de pagar. Además 2000 es el tope del
propio contrato de QAB (que **tolera** hasta 2000, no los exige), y menos páginas es menos ida y
vuelta dentro de un presupuesto de fase de 10 s con un timeout HTTP de 10 s por petición. El coste de
mantenerla es materializar ~251 KiB en memoria en el peor caso, que para una función serverless no es
un coste.

**4. El límite pasa a ser del cliente, no de la función.** `readBoundedBody` gana un segundo
parámetro **opcional** con valor por defecto `QAB_HTTP_MAX_RESPONSE_BYTES`. Ninguna llamada existente
cambia; el cliente de disponibilidad pasa el suyo. Un límite horneado dentro de una función
compartida por tres clientes con tres respuestas distintas era el mecanismo del fallo.

**5. Cada límite se declara donde el lector lo va a buscar.** `confirmed` gana su propio
`.max(QAB_AVAILABILITY_BATCH_SIZE)` en `qabAvailabilitySyncResponseSchema`, en vez de quedar acotado
solo por los bytes que `readBoundedBody` acepta. Una respuesta bien formada nunca puede confirmar
más items de los que la página llevaba —el otro lado empuja como mucho un par por item recibido—, así
que la cota es una invariante del cable y no una heurística. Dejarla implícita en el cap de bytes
repetiría el mecanismo exacto de este mismo defecto: una protección que vive en otro módulo, que el
siguiente lector no ve y que el siguiente ajuste desactiva sin enterarse. Y hay un argumento de
fondo: el ADR 0050 dice que solo `confirmed` autoriza una escritura, y un cuerpo que ya sabemos mal
formado no autoriza nada — un `confirmed` fuera de rango no se poda, falla la validación y ese
negocio se reintenta, como con cualquier otra respuesta inválida.

**Y una exigencia de verificación, que forma parte de la decisión.** Con una precisión que importa:
la aserción `QAB_AVAILABILITY_MAX_RESPONSE_BYTES >= maxAvailabilityResponseBytes(BATCH_SIZE)` es
**casi tautológica** —sus dos lados derivan de las mismas dos constantes— y solo caza que alguien
reescriba la aritmética. **El supuesto que de verdad hay que vigilar es otro:** que un par de ids
reales quepa en `QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES`. Eso es cierto mientras
`ProductoTienda.id` y `Tienda.id` sigan siendo `@default(uuid())`, y por eso se comprueba **contra el
generador declarado en `prisma/schema.prisma`, leído del disco**, no contra un uuid escrito a mano en
un fixture: un literal seguiría en verde justo el día que alguien cambie el generador. A eso se suma
el camino de página llena, con `QAB_AVAILABILITY_BATCH_SIZE` confirmaciones reales contra
`postQabAvailabilityBatch`, emparejado con su negativo (un cuerpo por encima del tope **sí** tiene que
rechazarse, o el test pasaría igual con el límite desactivado, [E-008]). Todo detallado en el contrato
de F-007.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Bajar `QAB_AVAILABILITY_BATCH_SIZE` a ~1000 y dejar el cap de F-002 | Cabe hoy, con ids uuid. Sigue siendo un tamaño fijo bajo un tope fijo con una suposición tácita sobre el largo de los ids, y más páginas por corrida dentro del mismo presupuesto de 10 s. Arregla el síntoma medido, no la clase |
| Bajar la página a 1249, el último valor que cupo | 1249 no es margen: es el borde exacto donde se midió el fallo. Un byte más por entrada —un id un carácter más largo, un campo nuevo en la respuesta— y vuelve el estancamiento |
| Subir `QAB_HTTP_MAX_RESPONSE_BYTES` para todos los clientes | Relaja el tope del catálogo y del aprovisionamiento, cuyas respuestas **sí** las dimensiona un tercero, para resolver un problema que no es suyo. Justo al revés de lo que hay que hacer |
| Elegir a mano un número redondo y holgado para disponibilidad (256 KB) | Vuelve a ser una constante suelta que alguien puede desalinear del tamaño de página. Cuesta lo mismo derivarla |
| Reintentar la página troceándola al recibir `RESPONSE_TOO_LARGE` | Añade un camino de recuperación para una condición que no debería ocurrir nunca, y que si ocurre significa que el presupuesto por entrada está mal. Complejidad a cambio de esconder la señal |

## Consecuencias

**A favor:**

- Desaparece el estancamiento permanente: una página confirmada entera cabe siempre, por
  construcción.
- Las dos constantes no se pueden desalinear: una es función de la otra, y hay una aserción que lo
  comprueba.
- El supuesto que faltaba —cuánto ocupa una entrada de confirmación— queda escrito, con número, y
  medido contra un caso real en la suite.
- El resto de clientes hacia QAB no se tocan.

**En contra / coste asumido:**

- El cliente de disponibilidad puede materializar ~251 KiB de una respuesta de un tercero, frente a
  los ~98 KiB de los otros dos. Sigue estando acotado, que es la propiedad que importa; deja de ser
  el mismo número para los tres.
- Tres constantes donde antes había una. Es el precio de que la relación sea explícita.
- `readBoundedBody` gana un parámetro. Aditivo y con defecto, pero es una función compartida por
  tres clientes y ya no se comporta igual para todos.

**Impacto en seguridad y escalabilidad:**

- **El tope sigue existiendo y sigue siendo la defensa real.** Un tercero —o un `QAB_API_BASE_URL`
  mal apuntado— no puede hacer que esta función lea un cuerpo ilimitado. Lo que cambia es el número,
  no la protección: 251 KiB en una función serverless no es un riesgo de memoria.
- No cambia nada del aislamiento multi-tenant: ni la consulta, ni el token, ni el `where` de la
  escritura.
- El estancamiento que esto corrige era **por negocio**: una tienda grande podía quedarse sin
  converger indefinidamente mientras las pequeñas seguían bien, sin ninguna señal salvo un
  `outcome: "error"` repetido en el informe de fase.

**Lo que este ADR no arregla, dicho para que no se dé por resuelto:** cualquier fallo determinista de
una página sigue deteniendo las páginas restantes de ese negocio (§ «Secuencia vinculante», paso 6) y
se repite igual en la corrida siguiente. Es el comportamiento correcto para la causa habitual —token
o red—, y aquí se elimina la única causa determinista conocida. Si aparecen otras, la señal es la
misma: un `negocioId` con `outcome: "error"` y `written: 0` corrida tras corrida.

## Nota sobre el plan de consulta (observación de QA, no bloqueante)

Al verificar F-007 con volumen, QA probó tres escenarios y Postgres **no** eligió
`idx_disp_divergente` en ninguno: con miles de filas le salieron más baratos otro índice o un
`Seq Scan`. En los tres planes el `Filter` reproduce carácter por carácter el `CASE` esperado, que es
lo que el ADR 0048 sí promete. El ADR 0048 dice explícitamente que **no** promete una forma de plan
([E-017]), así que esto queda como observación y no como defecto. Se anota aquí porque es el dato que
haría falta si algún día el coste de esa consulta importa.

[E-008]: ../../.agents/errors/E-008-datos-de-prueba-que-no-discriminan.md
[E-017]: ../../.agents/errors/E-017-un-absoluto-en-un-contrato-que-el-codigo-no-sostiene.md
