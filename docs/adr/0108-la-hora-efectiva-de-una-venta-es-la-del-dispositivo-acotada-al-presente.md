# ADR 0108: La hora efectiva de una venta es la del dispositivo acotada al presente

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-030

## Contexto

F-029 introdujo el corte del cierre comparando `Venta.createdAt` contra un instante fijado. Pero
`createdAt` la sella Postgres (`DEFAULT CURRENT_TIMESTAMP`, migración `20250324160538_init`) y
ninguna de las dos rutas de creación de venta la escribe: la hora que manda el dispositivo va a
`frontendCreatedAt`. De modo que el `createdAt` de una venta *offline* **es su hora de
sincronización**, y un corte al final de ayer difiere una venta que sí fue de ayer — la misma
mezcla que F-029 existe para evitar.

La incoherencia es interna al propio cierre: `src/lib/gastos.ts` ya elige la tasa histórica de una
venta con `frontendCreatedAt ?? createdAt`. Para la misma venta, la tasa se resuelve como si fueran
las 22:00 y la pertenencia al cierre como si fueran las 07:00. La convención de leer la hora de una
venta así vive en siete sitios del código —los dos de `sales-stream.ts` (incluido `soldAt`),
`gastos.ts`, la devolución, el borrado de una línea, el ticket y `SalesDrawer`— y
`src/lib/reports/aggregators/hour-weekday.ts` la documenta con todas las letras: *"when customers
actually bought rather than when an offline sale happened to sync"*. El corte fue el octavo sitio,
y se salió de la convención sin que nadie lo notara hasta probar F-029 en el navegador con el
feature ya cerrado.

Las restricciones que había que respetar:

- **El instante del corte lo sigue produciendo el servidor.** F-029 acotó todo corte a
  `fechaInicio < cutoffAt <= now` (`isSalesCutoffWithinPeriod`) precisamente para que un navegador
  con el reloj adelantado no colara un instante inválido; por eso el chip del día en curso resuelve
  a `mode: "now"`. Ese acotado no se toca.
- **`frontendCreatedAt` viene del dispositivo**, y aceptarla como eje del corte reabre esa puerta:
  una hora reclamada posterior a `now` es inalcanzable por cualquier corte válido, así que la venta
  se diferiría cierre tras cierre hasta que el reloj real la alcanzara.
- Los criterios 4 y 5 de F-030 hablan de esa misma situación y **ambos tienen que cumplirse**: el 4
  exige que una hora de dispositivo posterior al corte gane sobre un `createdAt` anterior ("nunca
  la más favorable de las dos"), y el 5 exige que un reloj adelantado no deje la venta fuera de
  todo cierre para siempre.

## Decisión

**La hora efectiva de una venta es la que reporta el dispositivo, acotada al presente.** Una sola
función pura, `saleEffectiveAt(sale, now)` en `src/lib/venta/saleTime.ts`:

- sin `frontendCreatedAt` → `createdAt`;
- con `frontendCreatedAt` **ya transcurrido** (`<= now`) → `frontendCreatedAt`;
- con `frontendCreatedAt` **todavía no ocurrido** (`> now`) → `createdAt`.

Contra ella comparan **todos** los consumidores del corte, incluidos los dos que ningún criterio
nombraba por separado: la partición en memoria, el filtro SQL del traspaso, la agrupación por día
de los chips, la construcción de la lista del diálogo, la hora que pinta cada fila, el instante que
fija tocar una fila (`SalesCutoffChoice` pasa a llevar `effectiveAt`, no `createdAt`) y la `fecha`
del `MovimientoStock` de la venta (ADR 0109).

`now` es **un parámetro**, nunca una lectura del reloj dentro de la función: cada petición lo toma
una vez y se lo pasa al loader y al `updateMany`, de modo que una misma venta no puede recibir dos
respuestas dentro de un mismo cierre.

Debajo queda `saleReportedAt(sale)` —`frontendCreatedAt ?? createdAt`, sin acotar—, que es la
convención preexistente nombrada una vez. Los siete sitios que la parafraseaban pasan a llamarla;
es una sustitución neutra en comportamiento. **El cap no se les aplica**: responde a "¿puede
alcanzarla un corte?", que es una pregunta del cierre, y aplicarlo a la tasa histórica sustituiría
un hecho del pasado por una lectura del presente.

La frontera, con su excepción escrita al lado: **nada decide pertenencia a un cierre con
`saleReportedAt`**. La única llamada admitida bajo `src/lib/cierre/` es la de `valueSales`, que no
decide pertenencia sino con qué tasa se valora una venta que ya se sabe dentro. Y de paso cierra
una divergencia preexistente: `valueSales` (`computeCierreTotals.ts`) resolvía la tasa con
`createdAt` mientras `computePercentageBaseTotals` la resolvía con `frontendCreatedAt ??
createdAt` **para la misma venta**. Pasa a usar `saleReportedAt`, que es lo que el propio parámetro
de `resolveSaleTasaSnapshot` ya declaraba como su contrato.

### Por abajo no hay cota, y es deliberado

El cap actúa solo por arriba. El `security-guardian` señaló que por abajo `frontendCreatedAt` llega
del cuerpo sin cota ninguna, y que desde el ADR 0109 esa hora se escribe en `MovimientoStock.fecha`:
un reloj disparatado dejaría el movimiento fuera de la ventana del período en que la venta se
contabiliza, y con él la identidad de existencias del ADR 0071.

Se decidió primero rechazar con 400 toda hora anterior al inicio del período abierto, y esa decisión
**quedó derogada el mismo día**: alcanzaba de lleno al camino de recuperación del APK, que ante un
período cerrado **mueve la venta al período abierto y reintenta** conservando la hora del
dispositivo. Decisión vigente del humano, 2026-09-09: esa venta **se acepta**.

**El invariante se enforza entonces en el punto de uso, no en la puerta:** `saleMovementFecha`
(ADR 0109) nunca sella un movimiento con una fecha anterior al período en que su venta se
contabiliza. Es mejor que una validación de entrada, y por razones que no son de estilo: cubre
también lo que no pasa por la ruta —una siembra directa, una fila histórica, una reasignación
manual—, no rechaza ninguna venta, y no pone una consulta en el camino de escritura más caliente del
sistema.

Consecuencia que se declara sin adornos: **la hora que manda el dispositivo no se valida por
abajo**. Se guarda tal cual, por absurda que sea, y decide de qué lado del corte cae la venta.

### Por qué el cap y no otra guarda### Por qué el cap y no otra guarda

Los criterios 4 y 5 se separan por **una sola pregunta: ¿esa hora ya ocurrió?** El par del
criterio 4 (`createdAt < corte < frontendCreatedAt`) tiene por fuerza la hora de dispositivo por
delante del sello del servidor, pero **ya transcurrida**; el caso del criterio 5 la tiene **en el
futuro**. Esa pregunta es la única que los distingue sin quedarse con la más favorable de las dos.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `min(frontendCreatedAt, createdAt)` | En el par exacto del criterio 4 el mínimo es `createdAt`, que es anterior al corte, así que la venta **entraría**. Es literalmente "la más favorable de las dos" que ese criterio prohíbe |
| Un umbral de desfase (`\|frontendCreatedAt − createdAt\| > N` → desconfiar) | El par del criterio 4 siempre tiene la hora de dispositivo por delante, y por cuánto depende de cómo lo siembre quien verifica: el criterio pasaría a ser función del fixture, no del código |
| Acotar en la escritura: rechazar o recortar un `frontendCreatedAt` posterior a la llegada | Es el mismo `min` cambiado de sitio, y no cubre el criterio 5, que se verifica **sembrando** la fila directamente en la base |
| Relajar la cota superior del corte para que pueda pasar de `now` | Reabre exactamente la puerta que F-029 cerró a propósito, y el alcance de F-030 excluye tocar de dónde sale el instante del corte |
| Rechazar con 400 toda hora anterior al inicio del período abierto | Se decidió y **se derogó el mismo día**: alcanza al camino de recuperación del APK, que mueve la venta al período actual conservando su hora. Rechazarla dejaría la venta sin sincronizar para siempre con el reloj del dispositivo **correcto** |
| Recortar el `frontendCreatedAt` que se guarda al `fechaInicio` del período | Guardaría un instante en el que no ocurrió nada, y además destruiría el único dato que conserva cuándo se hizo la venta de verdad |
| Una guarda de higiene más estrecha en la entrada (rechazar una fecha que no cae en **ningún** período de la tienda) | No protege ningún invariante que `saleMovementFecha` no proteja ya, cuesta una consulta por venta en la ruta más caliente, y puede volver a alcanzar por error al caso del APK. Queda como decisión separada del humano si alguna vez la quiere |
| Persistir la hora efectiva en una columna propia | Migración más backfill de datos históricos, que el alcance excluye; y congelaría el cap en el instante de la escritura, sin ganar nada que el parámetro `now` no dé |
| Dejar la hora de servidor y alinear el resto de la app hacia ella | Evaluada y **descartada por el humano** el 2026-09-09. Es defendible —es cuando el dinero entró de verdad al sistema— pero iría contra siete sitios que ya hacen lo contrario, uno de ellos documentándolo como deliberado |
| Que la fila del diálogo pinte `saleReportedAt` y solo la partición use el cap | Tocar una fila fija el corte en esa hora: si la pintada y la enviada no son la misma, la pantalla miente. Y el criterio 8 pide una sola definición |

## Consecuencias

**A favor:**

- Una venta *offline* de ayer a las 22:00 sincronizada hoy a las 07:00 entra en un cierre cortado
  al final de ayer, se agrupa bajo el encabezado de ayer y se pinta a las 22:00.
- La hora que decide el cierre y la hora que decide la tasa histórica de esa misma venta pasan a
  ser **la misma**: la incoherencia interna que originó este feature desaparece.
- La garantía de que una venta cae en **exactamente un** lado del corte no se apoya en que el
  reloj de la aplicación y el de Postgres coincidan —en Vercel son dos máquinas—, sino en la
  complementariedad exacta entre `isSaleIncludedInCutoff` y `deferredSalesEffectiveWhere`, que
  evalúan las mismas tres ramas con el mismo `now`.
- La regla vive en una función y sus consumidores la reciben por firma. `isSaleIncludedInCutoff` y
  `partitionSalesByCutoff` dejan de aceptar un instante suelto y aceptan la venta: ya no hay forma
  de colarles una columna a mano.
- `deferredSalesCreatedAtFilter` se elimina en vez de conservarse como envoltorio, así que no queda
  una segunda forma de expresar la frontera.

**En contra / coste asumido:**

- **El eje del corte pasa a ser el reloj del dispositivo, con lo que eso implica.** El cap descarta
  lo imposible —una hora que aún no ha ocurrido—, no lo improbable: un reloj **atrasado** produce
  una hora efectiva atrasada y la venta cae en un período anterior al que le tocaba. No se detecta
  y no se corrige.
- **La hora efectiva de una venta con el reloj adelantado no es estable mientras su período siga
  abierto:** cambia de rama en el instante en que el reloj real alcanza a la hora reclamada. Para
  toda venta cuya hora reportada ya transcurrió, es constante.
- **Y por eso el diálogo y "Mis Ventas" pueden pintar horas distintas para esa venta**: "Mis
  Ventas" pinta la reportada y el diálogo la acotada. Es deliberado: en el diálogo la hora es el
  eje por el que la venta se está ordenando. Para toda venta cuya hora reportada ya transcurrió
  —que es el caso del criterio 2 y el de cualquier venta honesta— las dos pantallas coinciden;
  la divergencia solo existe con la hora del dispositivo en el futuro, fuera de ese caso.
- **En el navegador, `now` es el reloj del cajero.** F-029 ya dependía de él para agrupar por día y
  para `resolveSalesCutoffRequest`; el cap añade una segunda dependencia: de qué lado cae una venta
  adelantada en la **pantalla**. No se corrige, porque `isSalesCutoffWithinPeriod` en el servidor
  ya rechaza lo que un navegador desviado produciría.
- **El filtro SQL del traspaso pasa de un predicado a un `OR` de tres ramas.** Es más difícil de
  leer que `{ gt: cutoffAt }` y hay que mantener las tres alineadas con la función en memoria. Se
  contiene exigiendo el test de complementariedad exacta en las tres ramas.
- **`valueSales` cambia un valor observable** —la tasa con la que se valoran las ventas de un
  cierre— sin que ningún criterio de los 12 lo pida. Solo se manifiesta en ventas cuyo
  `tasaSnapshot` tiene huecos: las que lo traen completo se valoran con él, que siempre manda.
- **Ninguna venta se rechaza por su hora, y por tanto ninguna hora se valida por abajo.** Un
  dispositivo con el reloj muy atrasado guarda esa hora tal cual, y con ella la venta entra
  siempre en el cierre que se esté haciendo, aparece bajo un chip de día absurdo en el diálogo, y
  se agrupa en ese día en los reportes —esto último ya ocurría antes de F-030—. Lo que **no** hace
  es descuadrar el libro de existencias: eso lo cierra `saleMovementFecha` (ADR 0109).
- **`Nada` no siempre deja el cierre sin ninguna venta.** Una venta cuya hora efectiva precede al
  `fechaInicio` de su período se queda **dentro**, porque todo corte válido es estrictamente
  posterior a `fechaInicio` y por tanto ninguno puede excluirla. Es una imposibilidad estructural
  del modelo de F-029, no un defecto de este ADR. **Y esas ventas se siguen creando**: la venta que
  el APK mueve al período actual es exactamente eso, por un camino vivo, normal y deliberado, no
  una reliquia. Lo que las hace inofensivas para el libro de existencias no es ninguna guarda en la
  puerta —no hay— sino `saleMovementFecha` en el punto de uso (ADR 0109), que deja su movimiento
  dentro del mismo período, con la misma propiedad estructural que su venta.

  > **E-017, y conviene decirlo aquí en vez de corregirlo en silencio.** Este bullet decía *"hacia
  > adelante el 400 impide que se creen filas así"* y llamaba "histórica" a la fila, cuando ese 400
  > **quedó derogado el mismo día**, unas líneas más arriba en este mismo documento. Es el mismo
  > patrón —un absoluto que el código no sostiene— reincidiendo **dentro del ADR del feature que
  > existe porque ese error apareció en F-029 y subió a Frecuentes**. Lo encontró el `qa`, no una
  > relectura. Corregido el 2026-09-09.
- **`/ventas` queda desalineado.** El historial sigue leyendo `createdAt` crudo, así que para una
  venta *offline* pintará una hora distinta de la del diálogo del corte. Fuera de alcance: ningún
  criterio lo cubre y el backlog lo define el humano.
- **Los datos ya guardados no se tocan.** Las ventas ya asignadas a un cierre se quedan donde
  están; no hay migración en el alcance.

**Impacto en seguridad y escalabilidad:**

- **El desfase no es solo un accidente del reloj: es una palanca deliberada, y se acepta a
  sabiendas.** `frontendCreatedAt` la elige quien opera el dispositivo. Un cajero puede
  **atrasar** el reloj para que su venta quede antes del corte y entre en el cierre que está a
  punto de hacerse, o **adelantarlo** para que la venta se difiera al turno siguiente y no aparezca
  en su propio arqueo. Lo que lo acota es poco: **por abajo, nada** —el desplazamiento hacia el pasado es libre y sin límite—;
  por arriba, el cap lo neutraliza
  **solo si el cierre ocurre antes de la hora reclamada**, y si ocurre después, la manipulación
  surte efecto. Lo que queda es rastro, no prevención: `Venta.usuarioId` dice quién la hizo, y
  `wasOffline`, `syncAttempts` y la distancia entre `frontendCreatedAt` y `createdAt` quedan
  guardados y permiten auditarlo después. **Ningún criterio de los doce pide prevenirlo**, y la
  alternativa —volver a la hora de servidor— es la que el humano descartó. Se escribe aquí para que
  dentro de seis meses la pregunta "¿alguien pensó en esto?" tenga respuesta.
- **Aislamiento:** no hay superficie nueva. Ninguna ruta nueva, ningún identificador que llegue
  desde la petición. `deferredSalesEffectiveWhere` no lleva cláusula de tenant **a propósito**: se
  combina con `cierrePeriodoId`, que la ruta ató a la tienda y la tienda al negocio de la sesión.
  El `now` contra el que se acota lo toma cada handler de su propio `new Date()` y **no es
  influenciable desde el cuerpo ni desde el query string**.
- La única columna añadida a una respuesta es `frontendCreatedAt` en el `GET` de ventas del
  período, sobre filas que ese mismo endpoint ya devolvía enteras y bajo el mismo
  `withTenantScope("venta", …, negocioId)`.
- **Escalabilidad:** ninguna consulta nueva. El `OR` de tres ramas se evalúa después de acotar por
  `cierrePeriodoId`, es decir sobre las ventas de **un período abierto**, que es lo que ya se
  recorre hoy. No se añade índice: uno sobre `frontendCreatedAt` no serviría a un plan que arranca
  por la relación del período.
- **Reversión barata:** no hay columna nueva ni migración. Revertir el código restituye el
  comportamiento de F-029 tal cual.
