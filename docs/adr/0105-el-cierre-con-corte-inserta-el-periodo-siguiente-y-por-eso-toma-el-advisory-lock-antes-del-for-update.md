# ADR 0105: El cierre con corte inserta el período siguiente, y por eso toma el advisory lock antes del `FOR UPDATE`

**Estado:** aceptado
**Fecha:** 2026-09-08
**Feature:** F-029

## Contexto

Hasta ahora había un reparto limpio: **cerrar** escribía `fechaFin` sobre una fila existente y
**abrir** insertaba una nueva. Por eso el cierre se protegía con un `FOR UPDATE` sobre el período
y las aperturas con `pg_advisory_xact_lock(hashtext(tiendaId))`: el `FOR UPDATE` no sirve para
serializar aperturas —no bloquea nada cuando la tienda todavía no tiene períodos, y bajo `READ
COMMITTED` no ve el `INSERT` sin confirmar de otra transacción—.

F-029 rompe ese reparto: cuando hay corte, el período siguiente **nace en el corte**, no en el
instante de pulsar cerrar, así que tiene que crearlo la misma transacción que cierra. El cierre
pasa a insertar.

Tres hechos comprobados en el código, dos de ellos contra lo que se daba por supuesto:

1. De las dos rutas de apertura, **solo `/api/cierre/[tiendaId]/open` toma el advisory lock**. La
   del APK, `/api/app/periodo/[tiendaId]/abrir`, usa únicamente `FOR UPDATE`.
2. El `POST` de venta toma ese mismo advisory lock **solo cuando la venta lleva vuelto en
   efectivo**, no siempre.
3. `/last`, `/open`, `/abrir` y el propio `close` resuelven "el último período" con
   `orderBy: { fechaInicio: "desc" }` y `LIMIT 1`.

Y una restricción de producto: el corte **persiste** y lo ven todos los cajeros de la tienda, así
que entre que el usuario lo fija y confirma el cierre, otro operador puede haberlo movido.

## Decisión

**El cierre toma `pg_advisory_xact_lock(hashtext(tiendaId))` como primera sentencia de su
transacción, antes del `FOR UPDATE` que ya tenía**, y crea el período siguiente dentro de esa
misma transacción cuando —y solo cuando— hay corte. El orden global queda: *advisory lock de la
tienda primero, bloqueos de fila después*, igual que en el `POST` de venta y en
`src/lib/movimiento/index.ts`. Ninguna ruta los toma en orden inverso: no hay ciclo.

Dentro del alcance de F-029 se añade **esa misma línea a `/api/app/periodo/[tiendaId]/abrir`**. Sin
ella, un cierre web y una apertura desde el APK pueden dejar dos períodos abiertos, y el criterio
10 sería cierto solo porque nadie ejecutó esa combinación.

**El rango válido del corte es estricto por abajo: `fechaInicio < corte <= ahora`.** Si se
admitiera `corte === fechaInicio`, el período cerrado y el nuevo compartirían `fechaInicio` y las
cuatro consultas que resuelven "el último período" podrían devolver el cerrado ante el empate,
concluir que no hay abierto y crear un tercero. Por eso el acceso rápido "Nada" fija el corte un
milisegundo después del inicio del período, no en el inicio.

**Chequeo optimista al confirmar:** el cuerpo del cierre lleva `expectedCutoffAt`, el corte que el
cliente tenía en pantalla. El servidor lo compara dos veces —una antes de calcular, para fallar
rápido, y otra **bajo el lock**, que es la que vale— y responde **409** si el guardado difiere. Es
lo que convierte el recuento del criterio 6 en verdadero y no solamente esperado.

**El mismo mecanismo protege al `PATCH` que fija el corte**, por un motivo distinto y igual de real:
dos cajeros pueden tener el diálogo de selección abierto a la vez, y sin chequeo optimista gana el
último y el primero no se entera hasta que refresca. Allí el corte esperado va además **dentro del
`where` del `updateMany`**, que es lo que cierra la ventana entre la lectura y la escritura sin
necesidad de una transacción.

**Chequeo del traspaso (criterio 8):** el `updateMany` que reasigna lo diferido debe mover **al
menos** tantas filas como el cálculo previó; `count < expectedDeferredCount` aborta la transacción
entera. La comparación es `<`, no `!==`, deliberadamente: una venta que *desapareció* del período
entre la lectura y la escritura es el fallo que hay que atrapar, mientras que una venta *nueva*
posterior al corte queda diferida correctamente por el propio `where` y abortar por ella no
protegería nada.

**Quién abre el período siguiente:** con corte, lo abre el servidor dentro de la transacción y la
respuesta lo devuelve; sin corte, la respuesta trae `openedPeriod: null` y la pantalla llama a
`openPeriod` como hoy. La pantalla decide por ese campo, nunca por si había corte.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dejar que la pantalla abra el período siguiente también cuando hay corte | No es atómico: si la apertura falla, las ventas diferidas quedan colgando o el período no nace en el corte. Y el `fechaInicio` correcto es un dato del servidor, no del navegador |
| Crear el período siguiente **siempre**, con o sin corte | Desvía el camino sin corte, que los criterios 2 y 10 exigen dejar intacto |
| Que el período nuevo nazca en el instante de pulsar cerrar | Es lo que decía la redacción vieja del criterio 11, y es falso bajo el corte: una `COMPRA` posterior al corte y anterior al cierre no caería en **ningún** período |
| Que el período nuevo nazca un milisegundo después del corte, para que las ventanas de movimientos no se solapen | El criterio 11 pide "exactamente en el corte" y el `qa` lo lee literal (E-018) |
| Mantener solo el `FOR UPDATE` en el cierre | No serializa contra un `INSERT` no confirmado de otra transacción: dos períodos abiertos dejarían de ser imposibles |
| Bloquear el cierre mientras haya un corte puesto, en vez del chequeo optimista | Un paso más en un flujo ya largo, y en una tienda con venta continua nunca se completaría |
| `count !== expectedDeferredCount` como condición de aborto | Haría fallar el cierre cada vez que llega una venta legítima durante el conteo del efectivo, que es justo el caso que el modelo resuelve solo |
| Guardar también el lado incluido con una comparación estricta | Abortaría el cierre ante la carrera del lado incluido —una venta que cambia de período entre el cálculo y la escritura—, que el mecanismo de *drift* del ADR 0036 ya repara sin bloquear nada. *Corregido el 2026-09-09: la justificación original citaba «una venta offline atrasada que sincroniza durante el cierre», y ese caso no puede darse — el servidor sella `createdAt` al sincronizar, así que esa venta es siempre posterior al corte y cae del lado **diferido**. Ver la sección final del ADR 0104.*|

## Consecuencias

**A favor:**

- Cierre y traspaso son atómicos: o se cierra y se mueven las ventas, o no cambia ninguna fila.
- "Dos períodos abiertos" vuelve a ser imposible, ahora también entre el cierre web y la apertura
  desde el APK.
- El operador no puede cerrar contra un corte que otro cambió sin enterarse.
- El reintento es viable: ninguna rama de fallo escribe, el corte persiste y los 409 llegan con su
  cuerpo intacto —el interceptor de `axiosClient` solo reescribe 401 y 403 (E-009)—.

**En contra / coste asumido:**

- El cierre serializa ahora con las aperturas y con las compras/ventas con vuelto de la misma
  tienda. El lock es por tienda y se libera al terminar la transacción: no afecta a otras tiendas
  ni a otros negocios.
- La respuesta de `PUT .../close` **cambia de forma**: pasa de ser el período cerrado a un objeto
  con el período cerrado, el nuevo (o `null`) y el resumen de lo diferido. El único llamador es
  `closePeriod` en `src/services/cierrePeriodService.ts`; no existe ruta de cierre en `/api/app`,
  así que el APK no se ve afectado.
- Dos códigos 409 nuevos en el cierre, más el del `PATCH`, que la pantalla tiene que saber leer.
- **El reintento automático del `PUT`, preexistente y ahora con más escritura detrás.** `PUT` está
  en `IDEMPOTENT_METHODS` de `axiosClient`, así que un fallo de red reintenta el cierre. Si el
  primero confirmó y la respuesta se perdió, el reintento recibe `PERIOD_ALREADY_CLOSED` de un
  cierre que sí movió ventas y creó el período. Este ADR **no** hace idempotente el cierre —haría
  falta una clave de idempotencia y es un cambio ajeno—, pero sí manda que la pantalla trate ese
  400 recargando y avisando en tono informativo, nunca con un error rojo sobre una caja que quedó
  correctamente cerrada.
- **Deuda que se asume y se deja escrita:** los gastos recurrentes se aplican en una petición
  aparte y **antes** del cierre (`applyGastosCierre` → `closePeriod`), así que no participan de su
  atomicidad. Como esa ruta responde 409 cuando ya se aplicaron, un cierre fallido no se podía
  reintentar: el segundo intento moría ahí. F-029 mitiga tratando ese 409 como continuación, no
  como fallo. Lo correcto —aplicarlos dentro de la transacción del cierre— es un cambio mayor de
  esa ruta y no entra en este feature.
- Una venta del lado incluido que cambie de período entre el cálculo y la escritura no se detecta:
  los totales guardados contarían una venta ya no asociada. No es una regresión (la carrera existe
  hoy) y la cubre el recálculo de superadmin del ADR 0036.

**Impacto en seguridad y escalabilidad:**

- El `updateMany` del traspaso no lleva cláusula de tenant propia y no la necesita: el `cierreId`
  quedó atado a la tienda y la tienda al negocio de la sesión antes de abrir la transacción. El
  `tiendaId` del período nuevo sale del *scope*, nunca del cuerpo.
- La reasignación es **un solo `UPDATE`** sobre `Venta.cierrePeriodoId`, que ya está indexado.
- El advisory lock se toma dentro de la transacción (`xact_lock`), así que no puede quedarse
  colgado si la conexión muere.
