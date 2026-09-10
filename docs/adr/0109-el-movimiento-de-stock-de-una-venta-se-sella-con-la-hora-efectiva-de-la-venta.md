# ADR 0109: El movimiento de stock de una venta se sella con la hora efectiva de la venta

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-030

## Contexto

`MovimientoStock.fecha` es `@default(now())` y el movimiento de tipo `VENTA` **no la fija**: las dos
rutas de creación de venta acumulan los movimientos y los insertan con `createMany` sin pasarle un
valor, así que la sella Postgres en el momento de la **sincronización**.

Mientras el corte del cierre ordenaba por `createdAt` eso era coherente: venta y movimiento
llevaban el mismo instante y caían siempre del mismo lado de un corte (es lo que F-029 comprobó al
retirar su advertencia sobre `/api/resumen-dia`, ADR 0104, corrección posterior). En cuanto el
corte pasa a ordenar por la **hora efectiva** (ADR 0108), esa coherencia se rompe: una venta
*offline* de ayer a las 22:00 entraría en el período cerrado y su movimiento de stock, fechado a
las 07:00 de hoy, caería en el nuevo. Sería el reflejo exacto del problema que el corte acababa de
resolver.

El humano lo decidió el 2026-09-09: **la fecha del movimiento debe ser congruente con el momento en
que la venta ocurrió realmente**, no con el de su sincronización. De ahí salen los criterios 10 y
11 de F-030.

Lo que hay que respetar al hacerlo:

- `/api/resumen-dia` (y su gemela de `/api/app/`) acota **todos** los movimientos por la ventana
  de fechas del período —`fecha: { gte: fechaInicio, lte: fechaFin ?? now }`— y con ellos cuadra la
  identidad `final − entradas + ventas + salidas` (ADR 0071). `DESAGREGACION_ALTA` está en sus
  entradas y `DESAGREGACION_BAJA` en sus salidas.
- El criterio 11 dice "SIEMPRE" y el spec ya declara dos bordes conocidos que no lo desmienten.
- `CreateMoviento` (`src/lib/movimiento/index.ts`) sirve a `COMPRA`, `MERMA`, traspasos y
  consignaciones, cuya `fecha` correcta **es** la del momento en que se registran.
- **El cliente del APK mueve al período abierto una venta cuyo período ya cerró**, conservando la
  hora del dispositivo (`sync_service.dart`, `_moverAlPeriodoActual`). Es deliberado, avisa al
  cajero, y el humano decidió el 2026-09-09 preservarlo. Esa venta vive en un período que empezó
  **después** de que ella ocurriera.

## Decisión

**La `fecha` de los movimientos que produce una venta se sella explícitamente con la hora efectiva
de esa venta**, calculada dentro de la transacción, después del `venta.create` que devuelve el
`createdAt` recién sellado por Postgres:

```
saleMovementFecha(venta, ultimoPeriodo.fechaInicio)
```

que es la hora efectiva **acotada por abajo al período en que la venta se contabiliza**:

| Caso | `fecha` del movimiento |
|---|---|
| hora efectiva **>=** `fechaInicio` del período | la hora efectiva |
| hora efectiva **<** `fechaInicio` del período | `fechaInicio + SALES_CUTOFF_STEP_MS` |

Se pasa `venta.createdAt` como reloj del cap del ADR 0108 —y no un `new Date()` aparte— por dos
razones: es el instante real en que la fila existió, y hace el sello **determinista e idéntico en
las dos rutas**. En ese punto el cap equivale a quedarse con la anterior de las dos horas, lo cual
es correcto aquí: la venta no puede haber ocurrido después de que el servidor la almacenara. El
criterio 4, que prohíbe quedarse con la más favorable, gobierna **la partición del cierre**, no el
libro de movimientos.

### Por qué la cota inferior, y por qué `createdAt` y no el inicio del período

`MovimientoStock` **no tiene relación con un período**. Su `fecha` es el único dato que dice a qué
período pertenece, y hace doble trabajo: "cuándo ocurrió" y "dónde se contabiliza". En el caso
corriente las dos respuestas coinciden. En uno no, y tiene nombre: **la venta movida al período
actual**. Verificado el 2026-09-09 en el cliente del APK (`sync_service.dart`,
`_moverAlPeriodoActual`): cuando el período de la venta ya cerró, el APK **mueve la venta al período
abierto y reintenta**, conservando intacta la hora del dispositivo, y avisa al cajero de que lo ha
hecho. El humano decidió el 2026-09-09 preservar ese camino tal cual.

Esa venta vive en un período cuyo `fechaInicio` es posterior a su propia hora efectiva. Sellar el
movimiento con esa hora lo pondría en la ventana del período **ya cerrado** mientras su venta se
contabiliza en el abierto — la disociación que el criterio 11 prohíbe, en el único caso normal en
que se produce.

**El fallback es el PRIMER instante que pertenece al período**, `fechaInicio + SALES_CUTOFF_STEP_MS`,
y la razón no es estética: **el movimiento tiene que heredar la posición que su propia venta ocupa
frente a cualquier corte.** Una venta cuya hora efectiva precede al `fechaInicio` está, por
construcción, **dentro de todo corte válido** de ese período — un corte es estrictamente posterior a
`fechaInicio` (`isSalesCutoffWithinPeriod`)—, y el único instante del período con esa misma
propiedad es el primero que le pertenece.

Las dos alternativas obvias fallan, cada una a su modo:

- **`createdAt`** —el instante de la escritura, que es lo que la columna guardaba antes de F-030—
  separa venta y movimiento en cuanto el corte cae **antes de la sincronización**. Con P2 abriendo a
  las 07:30 y la venta movida sincronizando a las 09:00, un corte a las 08:00 —o el propio gesto
  `Nada`— deja la venta en P2 y su movimiento en P3. No es exótico: lo produce cualquier corte de
  ese rango.
- **`fechaInicio` a secas** es **exactamente** el `fechaFin` del período anterior, así que el
  movimiento contaría en las ventanas de los dos, siempre, en todas las ventas movidas.

El coste del valor elegido está acotado a un solo gesto: con `Nada` el corte vale exactamente
`fechaInicio + 1 ms`, que es la fecha del movimiento, así que cuenta en los dos períodos. Es el
borde del milisegundo que el ADR 0104 ya declara y acepta — no uno nuevo—, y se paga a cambio de
eliminar una separación real.

El sello abarca los movimientos de tipo **`VENTA`** (criterios 10 y 11) **y también los
`DESAGREGACION_BAJA` y `DESAGREGACION_ALTA` que esa misma venta genera** en la misma transacción.
Esta extensión va más allá de la letra de los criterios y se decide aquí: si el `VENTA` de un
producto fraccionado se fecha ayer y su `ALTA` hoy, la identidad de `/api/resumen-dia` deja de
cuadrar **en los dos períodos**. Son un acto atómico y llevan un solo instante.

`CreateMoviento` **no se toca**, y ningún otro tipo de movimiento cambia de fecha.

**Aquí, y no en la ruta, es donde se protege la identidad del ADR 0071.** La alternativa que se
evaluó y se derogó —rechazar con 400 en la entrada toda hora anterior al período— alcanzaba al
camino del APK. La cota vive en el sello porque así cubre también lo que no pasa por la ruta: una
siembra directa en la base, una fila histórica, una venta que un administrador reasigna a mano.

### `/api/resumen-dia`, en qué queda

Con el movimiento fechado en la hora real, venta y movimiento vuelven a caer del mismo lado de un
corte en el caso corriente: los dos en el período cerrado si la hora efectiva es anterior al corte,
los dos en el nuevo si es posterior. Es lo que el criterio 11 pide y lo que se verifica leyendo
`/api/resumen-dia` de cada período.

**Lo que estaba en juego, con la aritmética delante.** `/api/resumen-dia` calcula por producto
`cantidadFinal = ProductoTienda.existencia` —la existencia **viva**, no una foto del cierre— y de
ahí reconstruye `cantidadInicial = cantidadFinal − entradas + ventas + salidas` sobre los
movimientos de la ventana. Si el movimiento de una venta movida se hubiera sellado con su hora
real, en el **período abierto** —el único donde esa reconstrucción significa algo, porque es el
único cuyo "final" es de verdad el final— el movimiento habría quedado fuera de la ventana:
`ventas` corto en esa cantidad y `cantidadInicial` subestimado en la misma, con la venta sí
presente en los totales del cierre de ese período. Y en el período **ya cerrado**, su resumen
habría contado una venta que sus totales guardados no incluyen. Con la cota, ninguna de las dos
cosas ocurre.

**Los cuatro bordes en los que ese "SIEMPRE" no es literal**, enumerados para que nadie rechace
código correcto por encontrarse uno (E-017):

1. **El milisegundo compartido.** Un movimiento cuya `fecha` coincide exactamente con el corte
   cuenta en los dos períodos (`lte` en el cerrado, `gte` en el nuevo), porque el criterio 11 de
   F-029 exige que el período nuevo empiece **exactamente** en el corte. Ya declarado en el ADR
   0104 y no se toca.
2. **La venta movida al período actual.** **Ya no es un borde**: la cota inferior la deja en el
   mismo período que su venta. Permanece en esta lista porque las **filas históricas** escritas
   antes de F-030 llevan ahí la hora de sincronización — que es la misma rama que la cota elige, así
   que también caen juntas.
3. **El reloj del dispositivo adelantado.** El movimiento se sella con `createdAt` (el cap dispara
   en el instante de la escritura), mientras la partición del cierre, evaluada más tarde, ya puede
   honrar la hora del dispositivo si para entonces transcurrió. Con un corte dentro de ese hueco,
   venta y movimiento caen a lados distintos. Requiere las tres cosas a la vez: reloj adelantado,
   corte en el hueco y cierre posterior a la hora reclamada.
4. **La reasignación manual de una venta a otro período** por un administrador: la relación cambia
   y la `fecha` del movimiento no. Es preexistente y ajeno a F-030, y se enuncia porque cae bajo el
   mismo absoluto.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dejar la `fecha` en `@default(now())` | Es lo que F-030 rompe: con el corte ordenando por hora efectiva, venta y movimiento se separarían en el caso **corriente** de una venta *offline*, no en un borde |
| Sellar solo el `VENTA` y dejar los `DESAGREGACION_*` de la misma venta en la hora de sincronización | La identidad `final − entradas + ventas + salidas` de `/api/resumen-dia` (ADR 0071) deja de cuadrar en los dos períodos para todo producto fraccionado |
| Sellar con `saleReportedAt` (sin acotar por ningún lado) | La `fecha` podría quedar **en el futuro**: fuera de la ventana `lte: fechaFin ?? now` de cualquier período, e invisible en el informe de existencias hasta que el reloj la alcanzara. Un libro con asientos futuros es peor que uno con un borde |
| Sellar con la hora efectiva sin mirar el período (sin cota inferior) | Cumpliría el criterio 10 en un caso que ese criterio **no nombra** y rompería el 11 en uno que **sí**: la venta movida quedaría contabilizada en el período abierto y su movimiento en la ventana del cerrado. La aritmética exacta de lo que eso descuadra está arriba |
| Acotar a `createdAt` (el instante de la escritura) | Separa venta y movimiento en cuanto el corte del período de aterrizaje cae antes de la sincronización — un corte a las 08:00 sobre una venta movida que sincronizó a las 09:00 deja la venta en el período cerrado y el movimiento en el nuevo. Rompe el criterio 11 en el mismo caso que se quería arreglar |
| Acotar al `fechaInicio` del período a secas | Ese instante es **exactamente** el `fechaFin` del período anterior, así que el movimiento contaría en las **dos** ventanas **siempre**, en todas las ventas movidas, en vez de solo bajo el gesto `Nada` |
| Rechazar la venta movida con un 400 en la entrada | Se decidió y se derogó el mismo día: rompe el camino de recuperación del APK, con el reloj del dispositivo **correcto**. Decisión del humano del 2026-09-09 |
| Recortar la `fecha` del movimiento al `fechaInicio` del período en el que la venta acabó (guarda del borde 2) | Es fechar el movimiento en un instante en el que no ocurrió, justo lo que el criterio 10 rechaza; y el borde 2 solo se cerraría de verdad reabriendo un período cerrado, que el alcance excluye y el ADR 0104 prohíbe |
| Mover la venta del borde 2 al período cerrado en vez del movimiento | Exige reabrir un período cerrado |
| Corregir retroactivamente la `fecha` de los movimientos de `VENTA` ya escritos | No hay migración de datos en el alcance de F-030, siguiendo el precedente de F-029, que tampoco reabre cierres pasados |
| Cambiarlo dentro de `CreateMoviento` | Sirve a `COMPRA`, `MERMA`, traspasos y consignaciones, cuya fecha correcta es la de su registro. Y los movimientos de venta ni siquiera pasan por ahí |

## Consecuencias

**A favor:**

- Una venta *offline* de ayer a las 22:00 sincronizada hoy a las 07:00 deja su `MovimientoStock`
  fechado ayer a las 22:00: el informe de existencias del día refleja cuándo salió la mercancía del
  almacén de verdad.
- Venta y movimiento vuelven a caer del mismo lado de un corte, que era la consecuencia nueva que
  el cambio de eje del ADR 0108 amenazaba con introducir.
- La `fecha` del movimiento **nunca queda en el futuro** —el cap se evalúa contra el instante en que
  la fila se escribió— **ni antes del período en que su venta se contabiliza**.
- El criterio 11 se cumple también en la venta movida al período actual, que era el único caso
  normal en el que venta y movimiento se separaban, **y se sigue cumpliendo con cualquier corte de
  ese período**, no solo sin corte.

**En contra / coste asumido:**

- **Para la venta movida al período actual, su movimiento no lleva la hora real**, sino el primer
  instante del período en que se contabiliza — una hora en la que no ocurrió nada, que es
  precisamente lo que el ADR 0110 prohíbe hacer con una `COMPRA`. La diferencia, y es la que
  justifica la excepción: allí se falsearía **cuándo ocurrió un hecho**; aquí se elige **dónde se
  contabiliza** algo cuya hora real vive intacta en otro sitio. No se puede tener las dos
  cosas: la hora real de esa venta pertenece a un período ya cerrado, y `MovimientoStock` no sabe
  decir "ocurrí entonces pero me contabilizo aquí" — no tiene relación con un período, solo fecha.
  La hora real **no se pierde**: sigue en `Venta.frontendCreatedAt`, que es lo que leen las
  pantallas, el ticket, los reportes y el propio cierre.
- **El borde del milisegundo pasa de improbable a reproducible.** El movimiento de una venta movida
  se sella justo donde el gesto `Nada` pone el corte, así que ese gesto lo hace contar en los dos
  períodos. Mismo borde, mismo efecto ya aceptado por el ADR 0104, ahora con un llamador concreto.
- **Bordes en los que el "SIEMPRE" del criterio 11 no es literal**, enumerados arriba: el
  milisegundo compartido y la reasignación manual, ambos preexistentes; el reloj adelantado, que
  introduce este feature y no se cierra; y **las filas históricas** de ventas ya movidas, cuyo
  movimiento lleva la hora de sincronización y que ninguna migración corrige.
- **El libro de movimientos deja de estar ordenado por el instante en que se escribió.** Un
  recorrido por `fecha` puede intercalar un `VENTA` retrofechado entre movimientos anteriores. Es
  la puerta por la que entra el caso del ADR 0110.
- **`existenciaAnterior` deja de ser reconstruible recorriendo por `fecha`.** Nunca lo fue del todo
  —es el número que la fila tenía en el momento de la escritura, no una reconstrucción del
  histórico— pero ahora la discrepancia es visible. No se corrige.
- **Los movimientos ya escritos se quedan con la hora de sincronización.** El cambio es hacia
  adelante y convivirán las dos convenciones en la misma tabla, sin ninguna marca que las
  distinga.
- **La reversión no es completa.** El código se revierte sin migración, pero las filas escritas con
  la hora efectiva la conservan.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento:** no hay camino de escritura nuevo. La `fecha` se escribe dentro de la misma
  transacción, sobre las mismas filas y con el mismo `tiendaId` que hoy; lo que cambia es un valor,
  no quién puede escribirlo. El instante procede de `venta.createdAt`, que sella Postgres, **no del
  cuerpo de la petición**: un cliente no puede fijar la fecha de un movimiento.
- **Escalabilidad:** coste cero. No hay consultas nuevas ni columnas nuevas; se rellena un campo
  que ya se insertaba con su valor por defecto, en el mismo `createMany`.
