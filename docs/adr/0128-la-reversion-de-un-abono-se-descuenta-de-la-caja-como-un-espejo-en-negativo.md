# ADR 0128: La reversión de un abono se descuenta de la caja como un espejo en negativo

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-035 (panel de cuentas por cobrar y registro de cobros), **por delegación de F-032**

> Cierra la contradicción 1 que el `arch-guardian` reportó al entregar el contrato y que el ADR 0127
> se limitaba a hacer inerte. **Extiende la propiedad de F-035 a dos puntos concretos de dos
> archivos de F-032** —los dos que filtran `tipo: "ABONO"`— y fija el tratamiento **con signo** que
> hace que una reversión reste, sin tocar `buildResumenMonedas` ni `valueAbonos`, que son la
> definición compartida de «dinero en gaveta».

## Contexto

`MovimientoCuentaPorCobrar` es un libro append-only y una reversión es una fila nueva, nunca un
`UPDATE` ni un `DELETE` (dosier § 5, criterio 11). Los dos motores que leen ese libro para armar la
caja filtran hoy `tipo: "ABONO"`, y **dicen por qué**:

- `periodCollectionsWhere` en `src/lib/cierre/loadCierreInput.ts`: *«Only ABONO: CONDONACION and
  AJUSTE_DEVOLUCION move no physical money, and REVERSION_ABONO has no writer yet.»*
- La carga de abonos de `construirResumenCajaAbierta` en `src/lib/movimiento/caja.ts`: la misma
  frase.

F-035 estrena ese escritor. Mientras el filtro no cambie, **un abono cobrado y revertido dentro del
mismo período sigue contando como efectivo en la gaveta** y en `totalCobrosCredito`.

Ampliar el filtro a `tipo: { in: ["ABONO", "REVERSION_ABONO"] }` **no arregla nada, lo empeora**:
`buildResumenMonedas` (`caja.ts`) y `valueAbonos` (`computeCierreTotals.ts`) solo **suman**. Los dos
recorren `pagosDetalle` y acumulan `convertToBase(linea.monto, …)`; ninguno resta nada que no sea
una línea de `vueltoDetalle`, y `vueltoDetalle` no sirve aquí por dos razones verificadas leyendo el
código: `buildResumenMonedas` lo descuenta de `totalEfectivo` pero **no de `totalTransfer`** —una
reversión de un cobro por transferencia no se descontaría—, y `CierreAbono` **no tiene** campo
`vueltoDetalle`, así que `totalCobrosCredito` no se enteraría.

Tampoco sirve persistir la reversión con importes negativos: `pagoLineaSchema`
(`src/schemas/pago.ts`, de F-031) declara `monto: z.number().positive()` y
`equivalenteBase: z.number().nonnegative()`, y `movimientoCuentaPorCobrarSchema.pagosDetalle` es un
`z.array(pagoLineaSchema)`. Una fila con líneas negativas **no parsearía** por su propio schema de
lectura, y rompería la invariante de forma del dosier § 5 («`pagosDetalle` reutiliza *verbatim* la
forma `IPagoLinea[]`»).

## Decisión

**Se descuenta, y se descuenta con un espejo en negativo construido en memoria en el momento de
leer. Nada negativo se persiste nunca.**

Tres piezas:

**1. La consulta se amplía y trae el origen en el mismo `SELECT`.** Los dos puntos pasan de
`tipo: "ABONO"` a `tipo: { in: ["ABONO", "REVERSION_ABONO"] }`, y añaden
`revierte: { select: { pagosDetalle: true, tasaSnapshot: true } }` al `select`. Es un `JOIN`, no un
N+1: la relación `revierte` ya existe en el modelo y `revierteId` está indexado por su clave
primaria de destino.

**2. Una función pura convierte esas filas en las que los dos motores ya saben leer.**
`netCollectionRows`, en `src/lib/cuentasPorCobrar/cobrosNetos.ts` (archivo nuevo, de F-035):

- una fila `ABONO` pasa tal cual;
- una fila `REVERSION_ABONO` se sustituye por un **espejo**: las líneas de `pagosDetalle` **del
  `ABONO` que revierte**, con `monto` y `equivalenteBase` **negados**, el `tasaSnapshot` **del
  origen**, y la `fecha` **de la reversión**;
- una reversión cuyo origen no vino en el `include` (imposible por la FK, pero el `select` puede
  fallar en tipos) se descarta sin aportar nada.

Ese espejo es **exactamente** lo que hace falta para que las dos funciones existentes resten:
`buildResumenMonedas` acumula `pago.monto` en `totalEfectivo`/`totalTransfer` y
`convertToBase(pago.monto, …)` en `equivalenteBase` —los tres bajan—, y `valueAbonos` acumula
`convertToBase(linea.monto, …)` en `totalBase` y en `transferBaseByDestination[destino]` —los dos
bajan, y el arqueo por destino del criterio 5 de F-032 sigue cuadrando—. **Ni `buildResumenMonedas`
ni `valueAbonos` se tocan.** Ninguna de las dos lee `linea.equivalenteBase`; se niega igualmente
para que la forma del espejo no mienta si alguien lo inspecciona.

**3. El neto sale exacto, no aproximado.** El espejo lleva el `tasaSnapshot` **del origen**, y
`valueAbonos` resuelve las tasas con
`resolveSnapshotFromHistory(historial, abono.tasaSnapshot, abono.fecha)`, donde el snapshot del
cliente **tiene precedencia**. Así el abono y su espejo se valoran con las **mismas** tasas aunque
la reversión ocurra semanas después, y la cancelación es exacta. Verificado ejecutando: un abono de
`100 USD` a 120 más `500 CUP` por transferencia vale 12.500 en base; su espejo, −12.500; el neto,
**0**.

### Qué le pasa a `totalCobrosCredito`

`totalCobrosCredito` es, por definición escrita en `computeCierreTotals.ts`, *«what entered the
drawer, never MovimientoCuentaPorCobrar.monto»*: la suma de `valued.totalBase`. Con el espejo dentro
de `input.abonos`, esa suma **neta sola**, sin una línea de código nuevo en el motor.

Consecuencia que hay que aceptar y decir en voz alta: **`totalCobrosCredito` puede quedar
negativo** en un período que solo contenga la reversión de un abono cobrado en un período anterior.
Es aritméticamente correcto —la ecuación de reconciliación del ADR 0112 sigue cumpliéndose, porque
el efectivo de ese período también bajó por el mismo importe— y es lo que de verdad pasó: ese
período devolvió dinero de una deuda cobrada antes. La pantalla de cierre (F-036) **no debe
tratarlo como un error**, y esto queda anotado para su dueño.

### Qué le pasa a un cierre ya cerrado

`periodCollectionsWhere` acota por `fecha` entre `fechaInicio` y `fechaFin`. Por tanto:

- Una reversión **posterior** a `fechaFin` cae fuera de la ventana: el período cerrado conserva su
  `ABONO` y **no cambia ni una cifra**. Es el corolario del dosier § 8 —«un abono registrado después
  de cerrar un período nunca modifica sus cifras»— aplicado a su reverso, y es lo que sostiene el
  criterio 8 de F-032.
- Una reversión **dentro** de la misma ventana neta a cero al recalcular.

**¿Cambia esto lo que ve un cierre ya cerrado hoy?** No, y el argumento es de hecho, no de diseño:
`REVERSION_ABONO` **no tiene escritor hasta que F-035 se despliegue**, así que **no existe ni una
fila de ese tipo en ninguna base de datos**. Ningún período cerrado antes de F-035 puede contener
una, y por tanto ninguno cambia de cifras al recalcularse. Lo que cambia es lo que producirán los
períodos **futuros** que contengan una reversión, que es exactamente el arreglo.

Y la idempotencia se conserva por construcción: la ventana es por `fecha` sobre un log append-only,
y el espejo se deriva de filas que ya no cambian. Dos recálculos del mismo período dan el mismo
número, hoy y dentro de un año.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Dejarlo como estaba (ADR 0127 sin enmienda): la fila es inerte y la deuda queda anotada** | Es lo que el arquitecto propuso y el humano rechazó, con razón: entrega a sabiendas una cifra de caja incorrecta, y el ADR 0121 documenta cómo terminan las deudas «para quien lo posea» — en F-033 se difirió una y volvió doce días después |
| **Ampliar el filtro a los dos tipos y nada más** | Es el arreglo aparentemente obvio y **duplica el error**: `buildResumenMonedas` y `valueAbonos` solo suman, así que la reversión entraría como un ingreso más y la caja pasaría de sobrar X a sobrar 2X. Es la razón exacta por la que el ADR 0127 eligió `pagosDetalle: null` |
| **Persistir la reversión con `pagosDetalle` de importes negativos** | `pagoLineaSchema.monto` es `.positive()` y `equivalenteBase` `.nonnegative()`: la fila no parsearía por su propio schema de lectura, que es de F-031 y no se toca. Y rompería la invariante de forma del dosier § 5 |
| **Persistir la reversión con el `vueltoDetalle` del origen** | `buildResumenMonedas` sí resta `vueltoDetalle`, pero **solo de `totalEfectivo`**: una reversión de un cobro por transferencia no bajaría `totalTransfer`. Y `CierreAbono` no tiene campo `vueltoDetalle`, así que `totalCobrosCredito` no netearía. Arregla la mitad visible y deja la otra mitad rota |
| **Añadir un parámetro `sign` a `buildResumenMonedas`** | Es la función que el dosier § 3 llama «el activo principal de todo el epic» y la usan el cierre, el resumen de caja abierta y el POS. Cambiar su firma para un caso de F-035 es exactamente lo que el mapa de propiedad existe para impedir. El espejo consigue lo mismo sin tocarla |
| **Restar la reversión con una segunda pasada en cada motor** | Dos pasadas es código de agregación nuevo en dos archivos ajenos, y `(a + b) − b` no devuelve `a` en coma flotante — el propio `caja.ts` documenta esa razón para no derivar `ventasEfectivo` por resta. Una sola pasada sobre filas ya neteadas no tiene ese problema |
| **Prohibir revertir un abono de un período ya cerrado** | Invierte el problema y prohíbe el caso legítimo: un cobro mal registrado hace tres días se corrige, y su reversión pertenece al período de hoy, que es donde el filtro ya la pone |

## Consecuencias

**A favor:**

- La caja vuelve a cuadrar sola con una reversión, en el período abierto y en el cerrado, sin
  código de agregación nuevo en ninguno de los dos motores.
- El arreglo es **una función pura de F-035** más dos cambios de consulta: es testable sin base de
  datos y el `qa` puede ejercitarlo con un `it.each`.
- El libro sigue siendo append-only y `pagosDetalle` sigue siendo `IPagoLinea[]` verbatim: la
  invariante de forma del dosier § 5 no se toca.
- Deja de existir la deuda declarada más grave del contrato.

**En contra / coste asumido:**

- **F-035 escribe en dos archivos de F-032, que está en `passes: true`.** Es la razón de este ADR y
  de que el alcance esté acotado a los **dos puntos que filtran `tipo: "ABONO"`** y a sus `select`.
  Nada más de esos archivos se toca. **El `qa` de F-035 tiene que re-ejecutar los criterios de
  F-032 que el contrato enumera en su § 12**: no es opcional, y sin eso el `passes: true` de F-032
  deja de significar lo que significaba.
- **`totalCobrosCredito` puede quedar negativo.** Es correcto y es nuevo. F-036, dueño de la
  pantalla de cierre, tiene que saber que ese número no es un error.
- **Un tercer archivo nuevo en `src/lib/cuentasPorCobrar/`.** `cobrosNetos.ts` no cabe en
  `applyMovimiento.ts` —que es la puerta de **escritura**— ni en `panel.ts` —que es la agregación
  del **panel**—, y no puede vivir dentro de los archivos de F-032 sin ampliar la delegación a
  archivos enteros. Extiende el ADR 0123 con el mismo argumento y **necesita el visto bueno
  explícito del coordinador**, igual que el segundo.
- **El espejo es una estructura que se parece a una fila persistida y no lo es.** Alguien puede
  confundirlo y tratar de guardarlo. Lo dice su docstring en la primera línea, y `pagoLineaSchema`
  lo rechazaría si alguien lo intentara — que es la red de seguridad, no la explicación.

**Impacto en seguridad y escalabilidad:**

- **Seguridad, y es lo que hay que mirar con más cuidado de todo este ADR:** la consulta ampliada
  **conserva intacta** la cláusula de tenant, `cuentaPorCobrar: { tiendaId }`, y el `include` de
  `revierte` navega la FK autorreferenciada, que la puerta única de escritura ya garantiza que
  apunta **a la misma cuenta** (ADR 0123). Aun así, el criterio 13 de F-032 —el que siembra un
  negocio N2 y comprueba que el JSON del cierre de N1 no cambia byte a byte— es el que hay que
  re-ejecutar **con una reversión sembrada en N2**, y está en la lista del § 12 del contrato por
  esa razón exacta.
- **Escalabilidad:** ningún `SELECT` nuevo. La ventana de la consulta no cambia; solo entra un tipo
  más y un `JOIN` por `revierteId` sobre la clave primaria. Las reversiones son, por naturaleza,
  una fracción pequeña de los abonos.
- **Reversión de esta decisión:** volver a `tipo: "ABONO"` en los dos puntos y borrar
  `cobrosNetos.ts` devuelve el comportamiento anterior sin tocar ningún dato. Es reversible en un
  diff pequeño, y esa es la razón de que el espejo se construya al leer y no se persista.
