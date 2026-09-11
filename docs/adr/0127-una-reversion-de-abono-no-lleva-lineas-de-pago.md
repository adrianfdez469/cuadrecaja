# ADR 0127: Una reversión de abono no lleva líneas de pago

**Estado:** aceptado · **enmendado el 2026-09-09 por el [ADR 0128](0128-la-reversion-de-un-abono-se-descuenta-de-la-caja-como-un-espejo-en-negativo.md)**
**Fecha:** 2026-09-09
**Feature:** F-035 (panel de cuentas por cobrar y registro de cobros)

> **La decisión de este ADR sigue en pie sin cambiar una coma: `REVERSION_ABONO` se persiste con
> `pagosDetalle: null` y `tasaSnapshot: null`. Lo que cambió es el motivo y la consecuencia.** Ver
> la enmienda al final, que es de lectura obligatoria: la deuda que este ADR declaraba **ya no
> existe**, y el argumento que sostiene la decisión es ahora más fuerte, no más débil.
>
> F-035 estrena el primer escritor de `REVERSION_ABONO`, y los dos motores que leen el libro
> —el resumen de caja abierta y el motor de cierre— están escritos con la premisa de que ese
> escritor **no existe**. Este ADR decide qué forma tiene la fila.

## Contexto

`MovimientoCuentaPorCobrar` es un libro **append-only**. Revertir un abono es una fila nueva de tipo
`REVERSION_ABONO` con `revierteId` apuntando al `ABONO` deshecho, nunca un `UPDATE` ni un `DELETE`:
`totalPorCobrarAlCierre` de un período cerrado se recomputa como «movimientos con
`fecha <= fechaFin`», y mutar filas cambiaría las cifras de un período ya cerrado (dosier § 5). El
criterio 11 verifica justamente eso — dos filas, la original intacta con su `id`, su `tipo` y su
`monto`.

Los dos consumidores de caja filtran hoy `tipo: "ABONO"` y **dicen por qué**:

- `src/lib/movimiento/caja.ts`, en `construirResumenCajaAbierta`: *«Only ABONO: CONDONACION and
  AJUSTE_DEVOLUCION move no physical money and carry a null pagosDetalle, and REVERSION_ABONO has
  no writer yet.»*
- `src/lib/cierre/loadCierreInput.ts`, en `periodCollectionsWhere`: la misma frase.

Ambos archivos son de **F-032**, cerrado. F-035 no los toca — el dosier § 9 se lo asigna a otro
feature y el spec lo repite.

En cuanto exista el escritor, la premisa de esas dos frases deja de ser cierta, y hay una
consecuencia real: **un abono cobrado y revertido dentro del mismo período abierto sigue contando
como efectivo en la gaveta**, porque el `ABONO` está ahí y la reversión no se mira. El widget de
caja y `totalCobrosCredito` sobreestiman por ese importe.

Arreglarlo es de F-032 o de quien herede esos archivos. Lo que F-035 sí decide es **qué forma tiene
la fila nueva**, y esa decisión determina si el arreglo futuro es correcto por defecto o si abre un
error peor.

`buildResumenMonedas` solo **suma**: recorre `pagosDetalle` y acumula. Su primera línea de guarda es
`if (!venta.pagosDetalle) continue;`. Así que:

- una `REVERSION_ABONO` **con** líneas de pago, si alguien amplía el filtro a
  `tipo: { in: ["ABONO", "REVERSION_ABONO"] }` sin más, se suma como **ingreso** y la caja
  sobreestima el **doble** del importe;
- una `REVERSION_ABONO` **sin** líneas de pago, ante esa misma ampliación ingenua, **no hace nada**.

## Decisión

**`REVERSION_ABONO` se escribe con `pagosDetalle: null` y `tasaSnapshot: null`.** La composición del
dinero que se deshace se lee por `revierteId`, que apunta al `ABONO` original y ya la lleva; no se
copia.

La fila lleva `monto` **exactamente igual** al del `ABONO` que revierte —la reversión es total, el
libro no tiene concepto de reversión parcial—, su `usuarioId`, y su `motivo`.
`applyMovimientoCuentaPorCobrar` rechaza una reversión cuyo `monto` no coincida con el del origen,
igual que rechaza la que apunta a otra cuenta o a un movimiento que no es un `ABONO`.

Y el desajuste con los motores de caja se declara, no se disimula:

> **Deuda conocida, dueño F-032 (o quien herede `src/lib/cierre/**` y `src/lib/movimiento/caja.ts`).**
> `periodCollectionsWhere` y la carga de abonos de `construirResumenCajaAbierta` filtran
> `tipo: "ABONO"` con el motivo escrito «REVERSION_ABONO has no writer yet». F-035 estrena ese
> escritor. Mientras el filtro no cambie, un abono revertido dentro de su propio período sigue
> contando en la gaveta y en `totalCobrosCredito`. **Ampliar el filtro no basta**:
> `buildResumenMonedas` solo suma, así que la reversión tiene que **restar** por un camino propio,
> leyendo el `pagosDetalle` del `ABONO` que revierte.

Esa nota va, con estas palabras, en el docstring de `applyMovimiento.ts` y en el contrato de F-035.
No se escribe en los archivos de F-032: son de otro feature.

**Lo que este ADR no afirma:** no dice que la caja quede correcta tras una reversión. Dice que la
fila **no la empeora** y que el arreglo futuro tiene el dato que necesita a un salto de distancia.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Copiar `pagosDetalle` y `tasaSnapshot` del `ABONO` verbatim** | Es la opción que parece más completa y es la trampa. `buildResumenMonedas` solo suma: el día que alguien amplíe el filtro de `periodCollectionsWhere` a los dos tipos —el arreglo aparentemente obvio— la reversión entraría como **ingreso** y la caja pasaría de sobreestimar por X a sobreestimar por 2X. El dato ya está a un `revierteId` de distancia; duplicarlo solo añade un camino para equivocarse |
| **Escribir el `monto` en negativo en la fila de reversión** | El comentario de la columna es explícito: *«Always POSITIVE and always in base currency. The sign belongs to `tipo`»*, y `MOVIMIENTO_CUENTA_POR_COBRAR_SIGN` es la única definición de ese signo. Un negativo rompería `computeSaldoAlCierre`, que multiplica por el signo del tipo: `+1 × (−400)` restaría en vez de sumar |
| **Que F-035 arregle también `caja.ts` y `loadCierreInput.ts`** | Son de F-032, que está cerrado y verificado. El ADR 0121 permite tocar lo ajeno cuando hay un defecto **verificado ejecutando** que **bloquea un criterio**: ninguno de los trece criterios de F-035 mide la caja tras una reversión —el criterio 11 mide que **perdonar** no la toca, que es otra cosa—, así que la condición no se cumple. Se declara la deuda y se le pone dueño |
| **Prohibir revertir un abono del período abierto, y permitirlo solo en períodos cerrados** | Invierte el problema: en un período cerrado las cifras son inmutables (ADR 0036) y la reversión sí las contradiría; en el abierto es donde tiene arreglo. Además el caso real —el cajero registró el cobro equivocado hace un minuto— es exactamente el que quedaría prohibido |
| **Permitir reversiones parciales** | Ningún criterio lo pide, no hay forma de expresarlo en el libro sin un segundo campo, y una «reversión de 150 de un abono de 400» es indistinguible de un abono negativo. Si hace falta devolver parte del dinero, es un movimiento propio con su tipo, no una reversión a medias |

## Consecuencias

**A favor:**

- La fila de reversión es inerte para los dos motores de caja tal y como están escritos hoy: no
  suma, no resta, no rompe nada.
- El arreglo futuro no tiene un camino fácil-y-equivocado: ampliar el filtro sin más **no hace
  nada** en vez de duplicar el error.
- El libro conserva la propiedad que lo hace útil: la original intacta, la reversión apuntándola, y
  `computeSaldoAlCierre` dando el mismo número desde cualquiera de las dos direcciones.

**En contra / coste asumido:**

- **Se entrega un feature con una cifra de caja que se sabe incompleta.** Un abono revertido dentro
  de su propio período deja `totalCobrosCredito` y el efectivo esperado altos por ese importe. Es
  el coste real, está escrito, y tiene dueño nombrado. El caso es poco frecuente —revertir un cobro
  registrado por error— pero no es hipotético.
- **La deuda se declara en un ADR y en un docstring, no en un feature abierto.** El ADR 0121 cuenta
  exactamente cómo termina eso: en F-033 se difirió un defecto «para quien lo posea», no había
  quien lo poseyera, y volvió doce días después. Aquí el dueño está nombrado —F-032 y sus
  archivos— pero **hace falta que el humano abra el feature**; este ADR no lo abre.
- **Leer la composición de una reversión cuesta un salto.** Quien quiera saber en qué monedas
  entró el dinero que se deshizo tiene que seguir `revierteId`. Es el precio de no duplicar.

**Impacto en seguridad y escalabilidad:**

- **Seguridad:** la reversión es la operación con más superficie del feature, porque **sube** un
  saldo. Se cierra por cuatro sitios: permiso propio (`operaciones.cuentasporcobrar.revertir`,
  fuera de la plantilla de vendedor), la cuenta resuelta con `withTenantScope`, la comprobación de
  que el `ABONO` origen pertenece a **esta** cuenta —la FK autorreferenciada solo garantiza que la
  fila destino existe—, y el rechazo de una segunda reversión sobre el mismo `ABONO`.
- **Escalabilidad:** una lectura más por reversión (el `ABONO` origen y sus reversiones previas),
  por id y sobre el índice `[cuentaPorCobrarId, fecha]`.
- **Reversión de esta decisión:** cambiar a copiar `pagosDetalle` sería un cambio de una línea, y
  habría que hacerlo **a la vez** que el arreglo de los motores de caja, nunca antes. Escrito aquí
  para que no se haga por separado.

---

## Enmienda del 2026-09-09 — el humano ordenó arreglar la caja, y la decisión no cambia

**Qué cambió fuera de este ADR.** El humano decidió que F-035 **arregle** el desajuste, por
delegación sobre los dos puntos de F-032 que filtran `tipo: "ABONO"`. Eso está razonado en el
[ADR 0128](0128-la-reversion-de-un-abono-se-descuenta-de-la-caja-como-un-espejo-en-negativo.md).

**Qué NO cambia aquí: la fila se sigue persistiendo con `pagosDetalle: null` y `tasaSnapshot: null`.**
El motivo original —«que el desajuste sea inerte»— caducó; el que lo sustituye es más fuerte:

> El efecto de una reversión sobre la caja es una **resta**, y `IPagoLinea` **no puede expresar una
> resta**: `pagoLineaSchema` (`src/schemas/pago.ts`, de F-031) declara `monto: z.number().positive()`
> y `equivalenteBase: z.number().nonnegative()`, y `movimientoCuentaPorCobrarSchema.pagosDetalle` es
> un `z.array(pagoLineaSchema)`. Una fila persistida con importes negativos **no parsearía por su
> propio schema de lectura** y rompería la invariante de forma del dosier § 5 («`pagosDetalle`
> reutiliza *verbatim* la forma `IPagoLinea[]`»).

Por eso el signo se pone **al leer**, no al escribir: `netCollectionRows`
(`src/lib/cuentasPorCobrar/cobrosNetos.ts`) construye en memoria un espejo con las líneas del
`ABONO` origen negadas, y **nada negativo toca nunca el disco**. La composición del dinero se sigue
leyendo por `revierteId`, exactamente como decía la decisión original.

**Qué se cae de este ADR:**

- La sección «Decisión», donde dice *«el desajuste con los motores de caja se declara, no se
  disimula»* y transcribe la nota de deuda conocida: **esa deuda ya no existe**. La nota
  correspondiente sale del docstring de `applyMovimiento.ts` y del § 11 del contrato, y la sustituye
  el § 13, que enumera los criterios de F-032 que hay que re-ejecutar.
- El primer punto de «En contra / coste asumido» —«Se entrega un feature con una cifra de caja que
  se sabe incompleta»— y el segundo —«La deuda se declara en un ADR y en un docstring»—: los dos
  quedan **sin objeto**.
- El párrafo final de «Reversión de esta decisión» decía que cambiar a copiar `pagosDetalle` habría
  que hacerlo a la vez que el arreglo de los motores. El arreglo ya está hecho y **no copia
  `pagosDetalle`**: la opción queda descartada por el schema, no por el calendario.

**Qué se refuerza:** la alternativa «copiar `pagosDetalle` verbatim» sigue descartada, y ahora por
dos razones independientes en vez de una — la trampa del filtro ampliado que ya estaba escrita, y
la imposibilidad de expresar el signo dentro de `IPagoLinea`.
