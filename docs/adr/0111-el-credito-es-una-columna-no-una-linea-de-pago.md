# ADR 0111: El crédito es una columna, no una línea de pago

**Estado:** aceptado
**Fecha:** 2026-09-08
**Feature:** F-031 (y gobierna todo el epic de cuentas por cobrar, F-031 … F-039)

> Este es el ADR fundacional del epic. Fija **dónde vive el crédito de una venta**, la invariante
> que lo acompaña, las reglas duras que se derivan de ella, y —lo más importante para quien lo lea
> dentro de seis meses— **por qué la caja sigue cuadrando sola**, que es lo que impide «arreglar»
> esto metiendo el crédito dentro de `pagosDetalle`.
>
> El contrato de interfaces de F-031 (`.agents/specs/F-031.md`) traduce esta decisión a firmas
> concretas. En caso de contradicción entre los dos documentos, **gana este**.

## Contexto

Hoy el sistema asume que toda venta se cobra en el acto: el dinero entra a la caja del mismo cierre
en que se entrega la mercancía. Eso deja fuera dos situaciones reales del negocio —mercancía que
sale con un instalador de confianza que liquida días después, y un pedido despachado con un
mensajero que vuelve con el dinero uno o dos días más tarde—, y en las dos el negocio pierde el
control de una parte de su capital.

La decisión de producto, cerrada por el humano y que ningún agente reabre, es modelarlo como **venta
a crédito**: al entregar se crea la `Venta` normal —baja inventario, entra al cierre, reconoce venta
y ganancia—, el dinero **no** entra a caja, y los cobros posteriores son **abonos** que entran a la
caja del cierre en que ocurren.

La pregunta técnica que quedaba abierta, y la que se decide aquí, es **cómo se representa la parte
no cobrada de una venta**. Las restricciones reales del código, todas verificadas leyéndolo:

- `Venta.pagosDetalle` es una columna `Json` con forma `IPagoLinea[]`, y
  `pagoLineaSchema.tipo` (`src/schemas/pago.ts:5`) es hoy `z.enum(["cash", "transfer"])`.
- `buildResumenMonedas` (`src/lib/movimiento/caja.ts:144`) arma la caja del período **iterando
  `pagosDetalle` y `vueltoDetalle`**. No mira `Venta.totalcash` en ningún momento.
- Esa misma función y `buildResumenPropinas` (`src/lib/tips.ts:127`) hacen
  `if (tipo === "cash") … else …` y **suman `equivalenteBase` fuera del `if`**.
- `buildTicketPayload.ts:25` construye la lista de monedas del ticket recorriendo `pagosDetalle`.
- `CheckoutView.tsx:585` documenta hoy la invariante
  `Σ pagosDetalle.equivalenteBase − Σ vueltoDetalle(base) = total + tipTotal`, que **nadie
  comprueba en servidor**.
- El sistema ya tiene este problema invertido y resuelto: `ProductoProveedorLiquidacion`
  (`prisma/schema.prisma:848`), donde `liquidatedAt IS NULL` significa «devengado y no liquidado».

## Decisión

**El crédito de una venta viaja en una columna propia, `Venta.creditoBase`, en moneda base. Nunca
es una línea de `pagosDetalle`, y `pagoLineaSchema.tipo` se queda en `z.enum(["cash","transfer"])`.**

La invariante de una venta pasa a ser, **sustituyendo** a la que documenta hoy
`CheckoutView.tsx:585`:

```
Σ pagosDetalle.equivalenteBase − Σ vueltoDetalle(base) + creditoBase = total + tipTotal
```

La deuda que esa columna origina se materializa en `CuentaPorCobrar` (una fila por venta a crédito,
`ventaId @unique`, `settledAt IS NULL` = viva) y todo lo que mueve su saldo se registra en
`MovimientoCuentaPorCobrar`, un log **append-only** con cuatro tipos: `ABONO`, `AJUSTE_DEVOLUCION`,
`CONDONACION` y `REVERSION_ABONO`.

### Las cuatro razones por las que no se amplía el enum

1. **Dos agregadores de caja tragarían el tercer valor en silencio, por partida doble.**
   `src/lib/movimiento/caja.ts:167` y `src/lib/tips.ts:152` hacen los dos
   `if (tipo === "cash") … else …` y suman `equivalenteBase` **fuera** del `if`. Un tercer valor
   entraría como transferencia *y* como equivalente base: dos fallos silenciosos por función, y el
   cuadre de caja mentiría por el monto exacto del crédito. Arreglar solo el `else` no basta —hay
   que sacar también el `equivalenteBase` de la rama muerta—, y ese endurecimiento se hace igual en
   F-031 (criterio 4) porque cierra la trampa para cualquier forma de pago futura, no solo para el
   crédito.

2. **`pagosDetalle` significa «dinero físicamente recibido».** Es el único array que
   `buildResumenMonedas` recorre para saber qué hay en la gaveta. Meter ahí una promesa de pago
   rompe el significado de la columna, y con él todo lo que se deriva de ella.

3. **El crédito no tiene moneda física.** Como línea contaminaría `map[pago.moneda]` en
   `buildResumenMonedas`, `buildResumenPropinas`, `src/lib/reports/aggregators/payment-mix.ts` y
   `buildTicketPayload.ts:25`, que arma la lista de monedas del ticket recorriendo `pagosDetalle`:
   el ticket mostraría una columna de conversión para una moneda que no existe.

4. **El abono ocurre semanas después, en otro cierre y con otro `tasaSnapshot`.** No cabe en el
   `pagosDetalle` de la venta, que es inmutable y pertenece al período de la entrega. La tabla de
   abonos hace falta de todas formas; una línea `credit` sería una **segunda representación del
   mismo hecho**, con dos sitios donde desincronizarse.

### Por qué la caja sigue cuadrando sola

**Es el activo principal de todo el epic, y la razón de fondo de las cuatro de arriba.**

`buildResumenMonedas` arma la gaveta iterando `venta.pagosDetalle` y `venta.vueltoDetalle`, y **no
mira `Venta.totalcash` en ningún momento**. Como el crédito no es una línea de `pagosDetalle`, una
venta a crédito **no aporta nada a la gaveta sin que nadie toque el motor de caja**: el conteo
físico del cajero se sigue comparando contra `totalEfectivo` exactamente igual que antes, y el
cálculo del descuadre (`MonedaBreakdownRow.tsx:155`, `breakdownTotal − totalEfectivo`) no se
modifica.

Dicho al revés, y esto es lo que hay que entender antes de tocar nada:

- Una venta a crédito **sube `totalVentas` sin subir el efectivo**.
- Un cobro de deuda vieja **sube el efectivo sin subir `totalVentas`**.

Las dos direcciones rompen la lectura ingenua de la gaveta, y para eso existen las dos cifras nuevas
del cierre —`totalCreditoOtorgado` y `totalCobrosCredito`—: no para **corregir** el cuadre, que ya
está bien, sino para **explicarlo**. La ecuación completa de reconciliación es del ADR de F-032.

**Corolario operativo:** la línea «Ventas a crédito» del desglose por moneda tiene que llevar escrito
que no entró a caja, en texto secundario y nunca en el rojo de una deducción. Sin esa frase un
cajero la resta y descuadra a mano lo que estaba cuadrado.

**Corolario para quien venga a refactorizar:** meter el crédito dentro de `pagosDetalle` —aunque sea
«solo para que el mix de pagos sume» o «para no tener una columna suelta»— **rompe el cuadre de caja
del producto entero**, no solo del epic. Si alguna vez parece la solución obvia, es porque no se ha
leído esta sección.

### Las reglas duras

Se validan **en servidor**, en las dos rutas de venta —la web y su espejo `/api/app/venta`—, y las
cablea **F-034**. F-031 solo entrega la función pura que las codifica
(`checkCreditInvariant`, `src/lib/cuentasPorCobrar/creditInvariant.ts`).

| Regla | Desenlace | Por qué |
|---|---|---|
| `creditoBase > 0 ⟹ clienteId` presente y del negocio | **409** | `isPermanentSyncError` aparca un 409 en vez de reintentarlo para siempre: una venta offline que nombra un cliente que no existe tiene que parar, no girar |
| `creditoBase > 0 ⟹ Σ vueltoDetalle === 0` | 400 | Dar vuelto y deber dinero por la misma venta es contradictorio |
| `creditoBase > 0 ⟹ tipTotal === 0` | 400 | `amountDue = finalTotal + tipTotal`, así que una propina a crédito es prestarle dinero al cliente para que propine |
| `creditoBase <= total` | 400 | Una deuda mayor que la venta no es una venta |
| Invariante dentro de `SALE_TOTAL_TOLERANCE_BASE` | 400 | Hoy **nadie la comprueba**, y con crédito es la única defensa contra una deuda inventada por el cliente |

Dos consecuencias de estas reglas que ahorran trabajo y hay que dejar escritas:

- **Gracias a la tercera, `validateTip` no se toca.** Su primera línea útil es
  `if (requested <= 0) return { ok: true, … }` (`src/lib/tips.ts:63`, comprobado), así que nunca ve
  una propina en una venta a crédito.
- **`paymentMath.ts` y `usePaymentLines.ts` tampoco cambian.** `PaymentLineKind` sigue con dos
  valores; la resta la hace el llamador, con `pendingInCurrency(finalTotal − creditoBase)`.

### La deuda se denomina en moneda base

`CuentaPorCobrar.monedaDeudaCode` y `montoDeudaMonedaOriginal` se guardan **solo como referencia
informativa**, para poder decirle al cliente «debes 20 USD». Ningún cálculo de saldo, de antigüedad
ni de la invariante los lee.

El argumento es decisivo y no es negociable: denominar la deuda en divisa haría que
`totalPorCobrarAlCierre` de un cierre ya cerrado **cambiara al mover la tasa**, rompiendo la
idempotencia del recálculo que el ADR 0036 estableció para las cifras guardadas de un cierre.

Por la misma razón el log de movimientos es **append-only**: `totalPorCobrarAlCierre` de un período
cerrado se recomputa como «movimientos con `fecha <= fechaFin`», así que mutar una fila cambiaría
las cifras de un período ya cerrado. Deshacer un abono es una fila nueva, `REVERSION_ABONO`, nunca
un `UPDATE` ni un `DELETE`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Ampliar `pagoLineaSchema.tipo` a `["cash","transfer","credit"]` | Las cuatro razones de arriba. La más grave es la primera: dos funciones sumarían la línea por partida doble y el cuadre de caja mentiría por el monto exacto del crédito, en silencio |
| Ampliar el enum **y** arreglar el `else` de las dos funciones | Arregla el fallo 1 y deja intactos el 2, el 3 y el 4. Y en cuanto el crédito está dentro de `pagosDetalle`, la propiedad «una venta a crédito no aporta nada a la gaveta» deja de ser estructural y pasa a depender de que cada consumidor futuro recuerde filtrarlo |
| Derivar el crédito por resta, `total − totalcash − totaltransfer` | Es una señal derivada sin columna que la escriba: exactamente E-013. Cualquier redondeo o cualquier venta legítimamente descuadrada se convertiría en una deuda inventada, y el chip de «venta a crédito» de la pantalla de ventas leería una resta en vez de un dato |
| Una tabla de «venta pendiente de cobro» en vez de una columna en `Venta` | Obliga a un `join` en todo lector de ventas para contestar «¿cuánto de esta venta se cobró?», que es una pregunta de la venta misma. La deuda sí merece su tabla —`CuentaPorCobrar`—, pero la **parte no cobrada del total** es un atributo de la venta |
| Denominar la deuda en la divisa en que el cliente la contrajo | Rompe la idempotencia del recálculo: `totalPorCobrarAlCierre` de un cierre viejo cambiaría cada vez que se mueve la tasa, contra el ADR 0036 |
| Guardar en `MovimientoCuentaPorCobrar` una FK al `CierrePeriodo` en que ocurrió el abono | Segunda representación del mismo hecho, que ya dice `fecha` — la misma razón 4 de arriba, un escalón más abajo. Podría desincronizarse de `fecha` al recalcular un cierre |
| No crear `CuentaPorCobrar` y derivar el saldo recorriendo los movimientos cada vez | La antigüedad de la deuda necesita una `fechaVenta` y un estado «viva/saldada» consultables; sin fila no hay dónde indexar el panel ni el filtro del corte, y `settledAt` es justo el precedente que `ProductoProveedorLiquidacion.liquidatedAt` ya validó |

## Consecuencias

**A favor:**

- El motor de caja no se toca para que una venta a crédito no aporte a la gaveta: sale gratis por
  construcción. El conteo físico y el cálculo del descuadre siguen siendo los de hoy.
- `pagosDetalle` conserva un significado único —dinero físicamente recibido—, y con él lo conservan
  el ticket, el mix de pagos y los dos agregadores de caja.
- Una venta anterior a la migración queda con `creditoBase = 0` y `clienteId` NULL, así que todo
  lector actual de `Venta` devuelve exactamente las mismas cifras que antes. Es lo que hace que la
  migración sea aditiva y que el epic no arrastre un recálculo del histórico.
- El endurecimiento del `else` de los dos agregadores (F-031, criterio 4) **sobrevive aunque el epic
  se descartara entero**: cierra la trampa para cualquier forma de pago futura —vales, puntos—, no
  solo para el crédito.
- La invariante pasa a comprobarse en servidor. Hoy no se comprueba en ninguna parte.

**En contra / coste asumido:**

- **Una columna más en `Venta`**, la tabla más leída del sistema, y un campo más que propagar por
  todo el camino de una venta: `CheckoutView`, `pos/page.tsx`, `salesStore`, `sellService`, el
  payload que `syncPendingSales` arma **campo a campo** (`pos/page.tsx:641-666`) y los tres
  reintentos manuales de `SalesDrawer.tsx`. Si `creditoBase` no se añade explícitamente en cada uno
  de esos sitios, una venta a crédito sincronizada tarde llega como venta al contado y la deuda no
  existe. Es trabajo de F-034 y está enumerado en el dosier § 6.
- **El chequeo de la invariante es más estricto que lo que el servidor hace hoy**, porque hoy no
  hace ninguno. Una venta con un sobrepago que no quedó registrado como vuelto
  —`Σ pagos − Σ vuelto > total + tipTotal`— se persiste hoy y sería rechazada por la nueva regla.
  En F-031 no cambia nada, porque ninguna ruta llama todavía a la función; **F-034 tiene que
  decidir y verificar qué hace con ese caso contra ventas reales** antes de rechazar nada.
- `saldoPendiente` es **denormalizado** y puede derivar si alguien escribe en
  `MovimientoCuentaPorCobrar` por fuera. La defensa es que un único helper,
  `applyMovimientoCuentaPorCobrar`, sea la única forma de insertar ahí, más un script de recálculo
  para reparar. F-031 fija sus nombres y **no los implementa**: los escribe el primer feature que
  escriba de verdad en la tabla.
- El log append-only crece sin cota por cuenta. Un abono es una fila; una cuenta que se cobra en
  diez plazos tiene diez filas. No hay purga y no se plantea ninguna: es el registro contable de la
  deuda.
- `@@unique([nombre, negocioId])` en `Cliente` cuenta también las filas con soft delete, así que
  recrear un cliente borrado con el mismo nombre devuelve `P2002`. Reactivar en vez de recrear es de
  F-033.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento multi-tenant.** `Cliente` lleva `negocioId` directo, como `Proveedor`.
  `CuentaPorCobrar` lleva una relación **directa** a `Tienda` —no solo a través de `Venta`— para que
  la cláusula de tenant sea un salto, `{ tienda: { negocioId } }`, y `MovimientoCuentaPorCobrar`
  llega por `cuentaPorCobrar → tienda`. Los tres caminos se declaran en `TENANT_RELATION_PATH`
  (`src/constants/tenantScope.ts`), que es la única definición del eje de tenant del proyecto: una
  ruta futura que use `withTenantScope` sobre estos modelos no puede equivocarse de camino, y un
  modelo nuevo sin camino no compila.
- **El salto directo tiene un invariante que el schema no impone.**
  `CuentaPorCobrar.tiendaId` **tiene que** ser el de la `Venta` que la originó: una FK simple a
  `Tienda` no puede exigir que coincida con la de otra tabla. Si se desalinean, la fila pasa
  `withTenantScope("cuentaPorCobrar", …)` bajo el negocio equivocado, con el camino intacto. Quien
  crea la fila —F-034, en la misma `$transaction` que la venta— deriva ese valor de la **misma
  variable ya persistida en `Venta.tiendaId`** y no lo relee de la petición. Va escrito en el
  comentario de la columna, no solo aquí.
- **`MovimientoCuentaPorCobrar.revierteId` es una FK autorreferenciada** y la base solo comprueba
  que la fila apuntada exista, no que sea de la misma cuenta ni del mismo negocio. La comprobación
  vive en `applyMovimientoCuentaPorCobrar`, y es la mitad de por qué ese helper es la única puerta
  de escritura de la tabla.
- **Borrar en blando a un deudor con deuda viva se bloquea.** `Cliente.deletedAt` es un `UPDATE`:
  no dispara ningún `onDelete` y deja la `CuentaPorCobrar` intacta pero fuera de cualquier listado
  que filtre por `deletedAt: null`, que es el patrón estándar del repo. Una deuda invisible es
  dinero que el negocio cree cobrado. La regla: el DELETE de `api/clientes/**` (F-033) devuelve
  **409** mientras haya una cuenta con `settledAt IS NULL`, y ninguna vista de saldo filtra las
  cuentas por `Cliente.deletedAt` — una que aparezca bajo un cliente borrado se muestra anotada, no
  se oculta.
- **Autorización.** Ninguna de las reglas duras se valida solo en el cliente: la función pura vive
  en `src/lib/` y F-034 la invoca desde las **dos** rutas de venta. La mitad de la primera regla que
  no es pura —que el `clienteId` sea del negocio— es una consulta acotada por `negocioId`, y le toca
  a F-034.
- **Escalabilidad.** `CuentaPorCobrar` nace con tres índices para los tres accesos que el epic ya
  tiene escritos: cuentas vivas de una tienda, cuentas de una tienda hasta un corte por fecha, y
  cuentas de un cliente. **No se ha medido ningún plan**, porque la tabla nace vacía y medir un plan
  sobre una tabla sin filas no dice nada (E-023): quien tenga filas reales —F-032 o F-035— es quien
  puede contrastarlos y ajustarlos.
- F-031 **no añade ningún índice a `Venta`**. Un `CREATE INDEX` normal sobre una de las tablas más
  calientes del sistema bloquea sus escrituras mientras construye, y la vía `CONCURRENTLY` exige su
  propia migración escrita a mano (ADR 0002). Ese coste le toca al feature que tenga de verdad la
  consulta.
- El filtro de cuentas abiertas al corte que usará F-032 es
  `fechaVenta <= corte AND (settledAt IS NULL OR settledAt > corte)`. **Simplificarlo a
  `settledAt IS NULL`** —que parece más limpio y pasa el caso obvio— hace desaparecer del recálculo
  toda cuenta ya cobrada y derrumba a cero el saldo histórico de todos los cierres anteriores. El
  comentario va junto al `where`, y F-032 lleva su propio criterio para atraparlo.
