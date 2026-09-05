# ADR 0075: El origen «tienda online» se hace visible en el resumen del reporte de ventas, y no solo en la columna

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-014
**Corrige:** el § 6 del contrato de interfaces de F-014, que decía que `src/lib/reports/**` no cambia

## Contexto

El criterio 6 de F-014 dice, literal:

> *«Un pedido entregado aparece en los reportes de ventas de esa tienda con su origen identificable
> como tienda online.»*

El ADR 0072 dejó el origen como un **dato consultable**: `Venta.pedidoEntranteId IS NOT NULL`. Y el
§ 6 del contrato de interfaces, escrito en el paso 4, declaró que `src/lib/reports/**` y
`src/lib/cierre/**` **no cambian**.

Las dos cosas juntas dejan el criterio a medias, y el paso 4b lo detectó al inventariar lo que su
pantalla no cubre: **nadie ve ese origen en ninguna parte.** No en `/ventas`, no en
`resumen_cierre`, no en los reportes.

El criterio tiene dos mitades y hoy solo una se sostiene:

| Mitad | Estado |
|---|---|
| «aparece en los reportes de ventas de esa tienda» | **Se sostiene.** La `Venta` lleva `cierrePeriodoId` del período abierto de esa tienda, y `sales-stream.ts` la recorre como a cualquier otra |
| «con su origen identificable como tienda online» | **No se sostiene fuera de la base de datos.** El dato existe en una columna que ningún reporte proyecta y ninguna pantalla muestra |

Y esto importa por cómo se cierra un feature aquí: **el `qa` verifica ejecutando, no leyendo
código**, y un criterio redactado así se lee como especificación (E-017). Un `qa` que abra el reporte
de ventas buscando distinguir un pedido online de una venta de mostrador no va a encontrar nada, y
tendrá razón.

## Decisión

**El origen viaja por la capa de reportes y se cuenta en el resumen. Dos cambios pequeños y
acotados, y ninguna pantalla nueva.**

### 1. `NormalizedSale` lleva el origen

`src/lib/reports/sales-stream.ts` añade a `NormalizedSale`:

```ts
/** Where the sale came from. TIENDA_ONLINE <=> the sale landed from an online order. */
origen: ISaleOrigin; // "POS" | "TIENDA_ONLINE"
```

y `normalizeSale` lo deriva de `venta.pedidoEntranteId === null`. **La consulta no cambia**: el
`findMany` usa `include: { productos, appliedDiscounts }`, que ya devuelve todos los escalares de
`Venta` — la columna nueva llega sola, sin un `select` que mantener.

### 2. El resumen cuenta las ventas de tienda online

`src/lib/reports/aggregators/summary.ts` añade a `SalesSummary` dos cifras:

```ts
/** How many sales of the range landed from an online order. */
cantidadVentasTiendaOnline: number;
/** Their net amount, in base currency. Part of `totalPeriodo`, not on top of it. */
totalTiendaOnline: number;
```

`createSummaryAggregator` es una función **pura** sobre `NormalizedSale`: el criterio 6 pasa a ser
comprobable **sin navegador y sin base de datos**, alimentándola con dos ventas normalizadas y
comparando las cifras. Y sigue siendo comprobable de punta a punta llamando al reporte de ventas del
período.

### 3. El cable hasta la pantalla — corregido el 2026-09-05 tras el 4b

**La primera redacción de este ADR se quedó en `SalesSummary` y dio por hecho que ahí terminaba el
camino. No terminaba.** La fila de KPI donde el diseño coloca la celda es la de
`/dashboard-resumen`, y ese componente (`DashboardKpiRow`) no lee `SalesSummary`: lee
`IDashboardSummary["ventas"]`, que es otro schema y otra ruta.

Comprobado leyendo los tres consumidores de `createSummaryAggregator`, no deducido (E-037):

| Consumidor | Qué hace con el resumen |
|---|---|
| `GET /api/dashboard/resumen/[tiendaId]` | **Ya lo invoca** y copia campo a campo a `IDashboardSummary.ventas`. Es el cable |
| `GET /api/reportes/[tiendaId]/tendencias` | Proyecta cuatro campos por nombre para comparar períodos. **No le afecta** |
| `GET /api/reportes/[tiendaId]/rentabilidad` | No lee ningún campo del resumen por nombre. **No le afecta** |

Como esa ruta ya construye la respuesta a mano desde `summary`, el camino completo son **cuatro
piezas y ninguna consulta nueva**:

1. `SalesSummary` gana las dos cifras (arriba).
2. `dashboardSummarySchema.ventas` gana las dos cifras.
3. `GET /api/dashboard/resumen/[tiendaId]` añade **dos líneas** a la copia que ya hace. La respuesta
   está tipada como `IDashboardSummary`, así que si falta una, `tsc` no compila.
4. `DashboardKpiRow` añade su celda.

Los otros dos consumidores no cambian porque proyectan **por nombre**, no por propagación.

### 4. La superficie, y su regla

Las cifras se pintan en la fila de KPI de `/dashboard-resumen`, con **una regla que es parte de esta
decisión**: se muestran **solo cuando `cantidadVentasTiendaOnline > 0`**. Un negocio que no usa la
tienda online no gana una casilla en cero para siempre.

Esa regla **no inventa un patrón**: `DashboardKpiRow` ya lo aplica a `Gastos`, `Merma` y
`Devoluciones de venta` con un `show: (…) > 0` y el comentario *«Deduction cards only appear when
there is something to deduct, so a clean period stays uncluttered»*. Es la misma disciplina, aplicada
a una celda más.

El copy, si son una celda o dos, y su comportamiento responsive **no se deciden aquí**: son del
`ui-designer`. Lo que sí es de este ADR es que **las dos cifras lleguen** al componente, sea cual sea
la forma que tomen: el recuento es la condición de la regla de arriba aunque solo se pinte el
importe.

### Lo que sigue sin cambiar

`src/lib/cierre/**`, `closing-totals.ts`, `income-statement.ts` y los demás agregadores. El cierre de
caja no distingue el canal: un peso cobrado es un peso cobrado, y `CierrePeriodo` ya separa lo propio
de lo consignado por otro eje. Añadir el canal ahí sería inventar un desglose que ningún criterio
pide.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dejarlo en el dato consultable y que el contrato diga cómo se comprueba con una consulta | Es la lectura más barata del criterio y la más frágil: «aparece en los reportes de ventas» no describe un `SELECT`. Deja al `qa` decidiendo si un criterio del backlog se cumple mirando la base de datos, y ese es exactamente el juicio que un contrato existe para no dejar abierto (E-017, E-030). |
| Una dimensión nueva «canal» en el reporte, con su desglose completo | Es lo que el criterio **no** pide. Una dimensión atraviesa `sales-stream`, los agregadores, los filtros y la pantalla; dos cifras en el resumen agotan «con su origen identificable» con una fracción del coste, y la dimensión sigue siendo posible el día que alguien la pida. |
| Marcarlo en el detalle de una venta (`VentaDetailDialog`) en vez de en el resumen | Responde «¿de dónde vino **esta** venta?», que es una pregunta distinta de la del criterio, y obliga a abrir venta por venta para responderla. Puede añadirse después; no sustituye al recuento. |
| Marcarlo en `/ventas` con una columna o un pill | `/ventas` es un listado operativo, no un reporte de ventas, y añadir una columna ahí es un rediseño de una tabla que F-014 no toca. |
| Llevar el canal también al `CierrePeriodo` | El cierre cuadra dinero, no canales. Sería un desglose desnormalizado más que mantener, y ningún criterio lo ejercita. |
| Mostrar siempre las dos casillas, también en cero | Todo negocio que no usa la tienda online cargaría con dos cifras vacías en su fila de KPI a perpetuidad. Un cero que no significa nada es ruido, y esta fila es lo primero que se mira. |

## Consecuencias

**A favor:**

- El criterio 6 pasa a ser verificable **ejecutando** en dos niveles: la función pura del agregador y
  el reporte de ventas del período.
- El cambio en `sales-stream.ts` no toca la consulta: la columna llega por el `include` que ya está,
  así que no hay proyección nueva que se quede desincronizada.
- `createSummaryAggregator` es puro, así que el `dev-tester` cubre el criterio sin base de datos.

**En contra / coste asumido:**

- **Corrige el § 6 del contrato de interfaces**, que decía que `src/lib/reports/**` no cambia. Esa
  línea era incorrecta y se rectifica en el contrato, no solo aquí: dos documentos que se contradicen
  producen una implementación y unos tests que divergen sin que ninguno se equivoque (E-030).
- **Este ADR se quedó corto en su primera redacción**, y es la misma trampa que describe E-037:
  «`SalesSummary` alimenta la fila de KPI» era una premisa razonable y falsa a medias — la alimenta
  a través de un segundo schema que hay que atravesar. El paso 4b lo detectó porque fue a colocar la
  celda y no encontró el dato. **Que una decisión de reportes termine en un agregador no significa
  que termine en la pantalla**: hay que seguir el cable hasta el componente y leer a sus
  consumidores.
- `IDashboardSummary` gana dos campos, así que cualquier prueba o fixture que construya ese objeto
  entero deja de compilar hasta completarlos. Es la red, no el problema.
- Vuelve a hacer falta el `ui-designer` para un anexo. Es pequeño —dos cifras en un patrón existente,
  más su regla de ocultación— pero es un paso más antes de implementar.
- `SalesSummary` gana dos campos. Cualquier consumidor que construya ese objeto a mano en un test
  dejará de compilar hasta completarlos, que es la red y no el problema.
- Las dos cifras son **parte** de `totalPeriodo`, no una suma aparte. Quien las lea sin saberlo puede
  sumarlas por encima del total; por eso el comentario del campo lo dice y el copy tendrá que decirlo
  también.

**Impacto en seguridad y escalabilidad:**

- Coste nulo en consultas: ni una consulta nueva, ni una columna proyectada de más, ni un índice. El
  agregado es una suma por venta ya recorrida.
- El ámbito del reporte no cambia: `sales-stream.ts` ya filtra por `scope.tiendaId` y por el rango de
  períodos de esa tienda, que es donde vive el aislamiento multi-tenant de los reportes.
- `pedidoEntranteId` es un uuid interno. No es `PedidoEntrante.code` y no se expone al comprador ni a
  nadie fuera del negocio (ADR 0061).
