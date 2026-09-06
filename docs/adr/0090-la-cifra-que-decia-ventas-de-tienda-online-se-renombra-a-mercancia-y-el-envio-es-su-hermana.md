# ADR 0090: La cifra que decía «ventas de tienda online» se renombra a mercancía, y el envío es una cifra hermana que se oculta en cero

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-024
**Modifica:** [ADR 0075](0075-el-origen-tienda-online-se-hace-visible-en-el-resumen-del-reporte-de-ventas-y-no-solo-en-la-columna.md), que creó `totalTiendaOnline`
**Depende de:** [ADR 0089](0089-el-envio-se-lee-del-pedido-y-viaja-en-la-venta-normalizada.md), que trae el importe hasta el agregador

## Contexto

El ADR 0075 añadió a `SalesSummary` y a `dashboardSummarySchema.ventas` dos cifras:
`cantidadVentasTiendaOnline` y `totalTiendaOnline`. La segunda se calcula sumando `sale.netAmount`,
que son **solo las líneas de producto**.

El nombre dice «el total de la tienda online». El cálculo dice «la mercancía de la tienda online».
Son cosas distintas en cuanto hay un envío cobrado, y esa discrepancia es exactamente la forma de
E-014: *«cuando el nombre y la consulta discrepan, gana la consulta — y el nombre es el bug»*. El
comentario del campo lo llamaba «their net amount», que es cierto y no basta: nadie lee el docstring
de un campo cuando el identificador ya le dijo lo que quería oír.

F-024 trae el envío hasta el agregador (ADR 0089) y obliga a decidir qué pasa con esa cifra. El
criterio 5 lo dice sin ambigüedad: *«ninguna se lee como “todo lo que factura el canal” si no lo
es»*.

Hay además una restricción de forma. La fila de KPI de `/dashboard-resumen` ya tiene una regla de
ocultación, aplicada a `Gastos`, `Merma` y `Devoluciones de venta`, con el comentario *«Deduction
cards only appear when there is something to deduct, so a clean period stays uncluttered»*
(`src/components/dashboard/DashboardKpiRow.tsx:41`). El criterio 4 pide esa misma disciplina para el
envío. Y el ADR 0075 fijó **otra** regla para la celda de tienda online: se pinta solo cuando
`cantidadVentasTiendaOnline > 0`. Las dos celdas van a estar una al lado de la otra con reglas
distintas, y eso hay que dejarlo escrito o alguien las «unifica» y rompe un criterio.

## Decisión

**`totalTiendaOnline` se renombra a `totalMercanciaTiendaOnline`, y el envío entra como una cifra
hermana `totalEnvioTiendaOnline` acompañada de `cantidadVentasTiendaOnlineConEnvio`. La ausencia se
resuelve en la vista, no en el agregador: los tres campos son `number` y valen `0`.**

### 1. Se renombra, no se añade al lado

El campo se llama ahora `totalMercanciaTiendaOnline` en `SalesSummary` y en
`dashboardSummarySchema.ventas`. **`totalTiendaOnline` desaparece: no se deja como alias.**

Un alias deprecado sería lo cómodo y es justo lo que no se puede hacer aquí. Dos nombres para la
misma cifra significa que el próximo lector elige el que suena mejor —y el que suena mejor es el que
miente— y que una corrección futura tiene que acordarse de los dos (E-014: la definición
parafraseada en ocho sitios de la que una se quedó atrás).

El coste está acotado y medido: fuera de tests, `totalTiendaOnline` aparece en **cuatro** archivos —
`src/lib/reports/aggregators/summary.ts`, `src/schemas/reports/dashboardSummary.ts`,
`src/app/api/dashboard/resumen/[tiendaId]/route.ts` y
`src/components/dashboard/DashboardKpiRow.tsx`. `GET /api/reportes/[tiendaId]/tendencias` y
`GET /api/reportes/[tiendaId]/rentabilidad` proyectan del resumen **por nombre** y no nombran esta
cifra, así que no les afecta. Ninguna columna, ningún dato persistido y ningún campo que consuma QAB
lleva este nombre: es un identificador interno de dos capas.

### 2. Redefinir `totalTiendaOnline` en el sitio, no

La otra salida era dejar el nombre y cambiar lo que suma, a `netAmount + deliveryFeeBase`, que sí
sería «todo lo que factura el canal». Se descarta: un campo que conserva su nombre y cambia de
significado es **peor** que uno cuyo nombre miente, porque no hay ningún síntoma. Todo consumidor
que ya lo lee —el `route.ts`, la celda, los tests, y cualquiera que compare un informe de la semana
pasada— sigue compilando y empieza a decir otra cosa. Renombrar hace que `tsc` señale cada punto de
lectura, uno por uno.

### 3. Tres campos, y qué mide cada uno

En `SalesSummary` y, con la misma forma, en `dashboardSummarySchema.ventas`:

| Campo | Qué suma | Relación con `totalPeriodo` |
|---|---|---|
| `cantidadVentasTiendaOnline` | Ventas del rango con `origen === TIENDA_ONLINE`. **Sin cambios** | — |
| `totalMercanciaTiendaOnline` | `sale.netAmount` de esas ventas. Es el antiguo `totalTiendaOnline`, mismo cálculo | **Parte** de `totalPeriodo` |
| `totalEnvioTiendaOnline` | `sale.deliveryFeeBase` de esas ventas | **Fuera** de `totalPeriodo`: `netAmount` nunca lo contuvo |
| `cantidadVentasTiendaOnlineConEnvio` | Cuántas de esas ventas cobraron envío (`deliveryFeeBase > 0`) | — |

La asimetría de la tercera fila es la parte que hay que entender y que el copy tendrá que decir: la
mercancía **ya estaba contada** en las ventas del período; el envío **no lo estaba nunca**, y por eso
este feature no cambia `totalPeriodo` (criterio 6) aunque saque una cifra a la luz. No es dinero
nuevo cobrado: es dinero que se cobró siempre y que el panel no mostraba.

`cantidadVentasTiendaOnlineConEnvio` existe para que el copy pueda ser específico —«3 de 8 pedidos
cobraron envío»— sin que la celda tenga que inventarse el dato. **El `ui-designer` puede usarla o
no**; la regla de ocultación no depende de ella.

### 4. La ausencia se resuelve en la vista

Los tres campos son `z.number()` **requeridos**, y valen `0` cuando no hay nada. Ni `optional`, ni
`nullable`, ni una unión.

Quién decide no pintar:

| Celda | Condición de `show` |
|---|---|
| Mercancía de tienda online | `(ventas.cantidadVentasTiendaOnline \|\| 0) > 0` — **regla del ADR 0075, sin cambios** |
| Envío de tienda online | `(ventas.totalEnvioTiendaOnline \|\| 0) > 0` |

Son distintas a propósito. La celda de mercancía se rige por el **recuento** porque una venta online
de importe cero sigue siendo una venta online que el comerciante quiere ver contada. La celda de
envío se rige por el **importe** porque «envío cero» y «no se cobró envío» son lo mismo: es
literalmente lo que dice el criterio 4, *«un pedido online sin envío no pinta una cifra de envío de
cero»*.

Y una consecuencia que **no hace falta escribir como tercera condición**, porque sale sola del
agregador: `totalEnvioTiendaOnline` solo se acumula dentro de la rama
`origen === TIENDA_ONLINE`, así que con `cantidadVentasTiendaOnline === 0` vale forzosamente `0` y la
celda de envío tampoco se pinta. La celda de envío no puede aparecer sin la de mercancía.

Tres razones para que la ausencia viva en la vista y no en el agregador:

1. Es el patrón que ese mismo componente ya aplica a `Gastos`, `Merma` y `Devoluciones de venta`.
2. `dashboardSummarySchema` con campos requeridos es lo que hace que la copia campo a campo del
   `route.ts` esté verificada por `tsc`: si falta una línea, no compila (ADR 0075 § 3).
3. Un agregador puro que devuelva «ausencia» necesita un triestado que los tests tienen que modelar.
   Un número se compara con `toBe(0)`.

### 5. El copy no se decide aquí

Qué dice cada celda, cómo se llama y si el orden cambia es del `ui-designer`, en
`.agents/designs/F-024.md`. Lo que **sí** es de esta decisión es que las dos cifras y los dos
recuentos lleguen al componente, y las dos reglas de ocultación de la tabla de arriba.

Para que ese copy sea comprobable sin navegador, la función de nota que hoy vive dentro de
`DashboardKpiRow.tsx` (`tiendaOnlineNote`) se muda a un `.ts` plano,
`src/components/dashboard/dashboardKpiCopy.ts`. Ningún símbolo de un `.tsx` es importable desde un
test en este proyecto (E-015), y el precedente exacto de un `.ts` de copy dentro de `components/` ya
existe: `@/components/tiendaOnline/orderPresentation`.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dejar `totalTiendaOnline` como está y añadir solo `totalEnvioTiendaOnline` | El nombre sigue diciendo «todo lo que factura el canal» al lado de una cifra que demuestra que no lo es. Es E-014 conservado a propósito, y el criterio 5 lo prohíbe |
| Mantener `totalTiendaOnline` como alias deprecado del nuevo nombre | Dos nombres para una cifra: el próximo lector elige el que suena mejor, y la próxima corrección se olvida de uno |
| Redefinir `totalTiendaOnline` como mercancía + envío | Mismo nombre, otro significado, cero síntomas. Todo consumidor sigue compilando y empieza a decir otra cosa |
| Una sola celda con el total del canal y el desglose en la nota | El criterio 1 pide **dos cifras separadas** cuya suma dé 55, y una nota no es una cifra: no se puede comparar a ojo con las demás celdas de la fila ni exportar |
| `totalEnvioTiendaOnline?: number` (ausente cuando no hay envío) | Rompe la comprobación por `tsc` de la copia campo a campo del `route.ts`, obliga al componente a distinguir «ausente» de «cero» y hace que el agregador puro tenga que devolver un triestado |
| Ocultar la celda de envío con `cantidadVentasTiendaOnlineConEnvio > 0` en vez de con el importe | Equivalentes hoy, pero el recuento admite una tercera lectura (un envío negativo, una devolución futura) donde el criterio 4 habla de importe. Se elige la condición que el criterio nombra |
| Renombrar todos los campos de `SalesSummary` al inglés de paso | `SalesSummary` es una familia de nombres en español ya establecida (`totalPeriodo`, `unidadesVendidas`, `gananciaTotal`…). Mezclar dos vocabularios en un mismo registro es peor que extender el que hay; ver § Consecuencias |

## Consecuencias

**A favor:**

- El identificador vuelve a ser literal: `totalMercanciaTiendaOnline` suma mercancía.
- `tsc` señala uno por uno los cuatro puntos de lectura del nombre viejo. Ninguno se puede quedar
  atrás en silencio.
- La regla de ocultación del envío no inventa un patrón: es el que ya usan tres celdas de esa misma
  fila.
- El copy de la fila de KPI pasa a ser comprobable sin navegador al mudarse a un `.ts` plano.

**En contra / coste asumido:**

- **Rompe dos archivos de test existentes**, `src/__tests__/salesSummaryTiendaOnline.test.ts` y
  `src/__tests__/dashboardSummarySchemaTiendaOnline.test.ts`, que nombran `totalTiendaOnline`.
  Actualizarlos es del `dev-tester`, no del `implementer`: las fronteras de escritura del paso 5 son
  disjuntas y esta es justo la clase de archivo donde se pisarían.
- **Desviación declarada de la convención de idioma de `AGENTS.md`.** Los tres campos nuevos van en
  español porque extienden un registro cuyas claves ya lo están; un `onlineDeliveryTotal` en medio de
  `totalPeriodo` y `gananciaTotal` obliga a leer dos vocabularios en la misma fila. `NormalizedSale`,
  en cambio, tiene su juego de campos en inglés, y por eso el campo de ADR 0089 se llama
  `deliveryFeeBase`. La regla que se aplica es la de `AGENTS.md` — «mantenlos donde ya existen» —
  entendiendo que extender un registro existente es mantenerlo, no fundar vocabulario nuevo.
- La fila de KPI puede llegar a mostrar dos celdas de tienda online seguidas. Cuántas se pintan y en
  qué orden lo cierra el `ui-designer`; esta decisión solo garantiza que los datos estén.
- `cantidadVentasTiendaOnlineConEnvio` puede acabar sin usarse si el diseño no lo necesita para el
  copy. Es un `+= 1` en un agregador que ya recorre la venta.

**Impacto en seguridad y escalabilidad:**

- Ni consulta nueva ni columna nueva: todo el coste está en ADR 0089. Aquí solo hay dos sumas y un
  contador más por venta ya recorrida.
- El aislamiento no cambia. `/api/dashboard/resumen/[tiendaId]` conserva su permiso
  (`recuperaciones.dashboard.acceder`) y su resolución de ámbito por `resolveReportScope`.
- **`totalPeriodo`, el cierre de caja y `CierrePeriodo` no cambian**, y F-024 no añade ninguna
  escritura: es una forma nueva de leer un dato ya persistido. `src/lib/cierre/**`,
  `closing-totals.ts` y `income-statement.ts` no se tocan.
