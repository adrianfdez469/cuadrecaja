# ADR 0127: El estado de crédito viaja en la venta serializada, y los abonos en una ruta propia

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-035

## Contexto

El criterio 1 de F-035 pide distinguir en `/ventas` una venta a crédito **con saldo vivo** de una
**ya saldada**. El criterio 2 es más exigente sobre el mecanismo:

> «Esa marca se lee de un campo **EXPLÍCITO de la venta serializada** y NO se deduce de
> `totalcash + totaltransfer < total`… Es la forma exacta de E-013.»

Esa redacción es un dato del contrato: la marca tiene que salir de un campo que viaja **en la
venta**, no de un cruce lateral y no de una resta.

Lo que hay hoy, verificado en el código:

- `IVenta` (`src/schemas/venta.ts`) ya declara `creditoBase`, `clienteId` y `clienteNombre`, y la
  GET que alimenta la lista (`api/venta/[tiendaId]/[cierreId]/route.ts`, de **F-032**, cerrada) ya
  los devuelve. Eso resuelve el criterio 2 —`creditoBase === 0` es el campo explícito— pero **no**
  el criterio 1: no viaja ni `saldoPendiente` ni `settledAt`, así que «vivo» y «saldada» no se
  pueden pintar.
- Esa GET no está en el patrón `api/venta/**/[ventaId]/**` que F-035 tiene concedido (dosier § 9).
- `GET /api/cuentas-por-cobrar` (F-033) sí devuelve todas las cuentas con `ventaId`,
  `saldoPendiente` y `settledAt`, pero exige el permiso `recuperaciones.cuentasporcobrar.acceder`,
  que un cajero no tiene por qué tener. **Ningún criterio de F-035 pide un permiso nuevo.**
- La GET de la lista corre con `assertTiendaTenant({ …, permisoRequerido: null })`: es flujo de
  caja, deliberadamente sin permiso (ADR 0078, deuda F-021 anotada en `routeGuards.json`).

## Decisión

**El estado de crédito de una venta viaja como un bloque explícito dentro de la venta serializada,
y la GET de F-032 se extiende por delegación escrita.** Los abonos, que son una lista y solo hacen
falta al abrir el detalle, viajan por una **ruta propia de F-035** bajo `[ventaId]`.

Tres piezas:

1. **`ventaCreditoResumenSchema`** — un objeto nuevo (`src/schemas/ventaCredito.ts`, de F-035) con
   `cuentaId`, `montoOriginal`, `saldoPendiente`, `settledAt`, y el resumen de cobros (`cobros`,
   `cobrosMontoBase`) y de filas del libro (`movimientos`) que el gate del ADR 0126 necesita.
   Cuelga de `ventaSchema` como `credito`, `nullable().optional()`: `null`/ausente significa «esta
   venta no tiene cuenta por cobrar».
2. **Delegación escrita** sobre cuatro archivos ajenos, todos de forma aditiva: `src/schemas/venta.ts`
   y la GET del listado (F-029/F-032), más `src/store/salesStore.ts` y
   `src/app/pos/components/SalesDrawer.tsx` (F-032), que son los que hacen llegar el bloque al
   `Sale` de los dos drawers del POS donde el criterio 5 exige el bloqueo. El precedente es el
   propio F-032, que editó dos archivos de F-029 por delegación escrita (ADR 0111).
3. **`GET /api/venta/[tiendaId]/[cierreId]/[ventaId]/credito`** — ruta nueva **dentro** del patrón
   concedido a F-035, con el mismo régimen que su hermana del listado: `assertTiendaTenant` con
   `permisoRequerido: null`, `withTenantScope` sobre la `Venta`. Devuelve la cuenta y su libro
   completo para **una** venta, y la abre solo el diálogo de detalle cuando la venta trae `credito`.

El estado de tres valores no se deriva en cada pantalla: lo resuelve **una sola función pura**,
`resolveVentaCreditoEstado`, en `src/lib/cuentasPorCobrar/ventaCreditoEstado.ts`. Una señal derivada
cuya definición se parafrasea en tres sitios es E-014, y en un `.tsx` no sería testeable (E-015).

El chip que la pinta nace **compartido desde el primer día**, en `src/components/credito/`, porque
la bandeja de pedidos online de F-036 usa el mismo (dosier § 4: «No se escriben dos»).

### Lo que NO se hace, y es la respuesta a la pregunta 4 del spec

La excepción de propiedad sobre `src/app/pos/components/UserSalesDrawer.tsx` y
`SaleProductsDetailDrawer.tsx` **se limita al gate de borrado y a su motivo visible**. No se amplía
a presentación, y **`src/components/SaleExtrasSummary.tsx` no se toca**. El bloque de deudor, monto,
saldo y abonos del criterio 3 se pinta en un componente **nuevo** bajo
`src/app/ventas/components/`, consumido solo por `VentaDetailDialog.tsx`.

La razón no es celo territorial: `SaleExtrasSummary` lo comparten los drawers del POS, que trabajan
sobre `Sale` y no van a recibir la lista de abonos. Pintar ahí el bloque obligaría a llevar el libro
entero al `Sale` local y a su persistencia en LocalStorage —para una pantalla que el POS no
pide— y a que un feature de `/ventas` decidiera el layout de dos pantallas del POS.

### Enmienda del 2026-09-10, tras el paso 4b

El `ui-designer` reabrió esta mitad de la decisión (`.agents/designs/F-035.md`, § 8, pregunta 1) con
dos hechos que no estaban sobre la mesa: el motivo del bloqueo **está** en el DOM en todo momento
—MUI copia el `title` del `Tooltip` al `aria-label` del `<span>` envolvente—, y en táctil ese
`Tooltip` solo se abre con una pulsación mantenida de **700 ms**.

**La excepción se amplía a presentación en `SaleProductsDetailDrawer.tsx` y NO en
`UserSalesDrawer.tsx`.** El primero muestra **una** venta, así que cabe el mismo bloque visible del
motivo que el diálogo; el segundo lista **una fila por producto de muchas ventas distintas**, así
que un bloque visible tendría que ir por fila, que es exactamente lo que el diseño descarta para la
lista de `/ventas`. En `UserSalesDrawer` el motivo sigue estando —en el DOM, y con pulsación
mantenida o `hover`—, y ese es el coste que se asume para no volver ilegible una tabla que este
feature no diseñó.

Lo demás de esta sección no cambia: `SaleExtrasSummary.tsx` no se toca, y el bloque de crédito del
criterio 3 sigue naciendo en `src/app/ventas/components/`. El detalle está en el contrato, § 0.4.

### Enmienda del 2026-09-10, tras el paso 5: la forma que `strict: false` admite

`settledAt` viaja en `ventaCreditoResumenSchema` como `z.coerce.date().nullable()`, y **con el
`strict: false` de este repo zod lo infiere como `settledAt?: Date`**: la clave se vuelve
**opcional** y el `| null` desaparece, porque con `strictNullChecks` apagado
`undefined extends Date | null` es cierto. Verificado ejecutando `tsc` con los dos ajustes; con
`strict: true` la misma expresión infiere `settledAt: Date | null`.

**Consecuencia, y vale para todo el epic:** cualquier interfaz estructural que tenga que aceptar un
tipo derivado de un schema con `.nullable()` declara esa clave **opcional** y la compara con
`!= null`, que cubre a la vez el `null`, el `undefined` y la clave ausente. Declararla requerida no
compila, por mucho que el schema diga `.nullable()`, y el `TS2322` que sale no menciona `strict`:
se lee como un error del contrato en vez de como el interruptor. Es el mismo interruptor de E-036
con otra consecuencia. El contrato lo recoge en su § 0.6 (d) y su § 4.1.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Cruzar en el cliente contra `GET /api/cuentas-por-cobrar` y armar un mapa `ventaId → saldo` | Exige `recuperaciones.cuentasporcobrar.acceder`; un cajero sin él vería todas las ventas a crédito iguales. Y no es «un campo de la venta serializada»: es una deducción de otra respuesta, la misma forma que el criterio 2 rechaza |
| Un endpoint propio de F-035 que devuelva el mapa `ventaId → estado` para el período | Dos peticiones para pintar una lista, dos estados de carga y una ventana en la que el chip no coincide con la fila. Y sigue sin ser un campo de la venta |
| Deducir el estado de `creditoBase > 0 && totalcash + totaltransfer < total` | Es literalmente E-013, y el criterio 2 lo siembra con la venta de resto de redondeo (total 10.00, cash 9.99) que esa deducción marcaría como crédito |
| Meter el libro de movimientos en la GET del listado | La lista carga todas las ventas del período: un `include` de los movimientos de cada cuenta crece con los abonos y no se pagina. El detalle lo abre el usuario de una venta a la vez |
| Reutilizar `GET /api/cuentas-por-cobrar/cliente/[clienteId]` para el detalle | Mismo permiso, y devuelve todas las cuentas del deudor cuando el diálogo pregunta por una venta |
| Ampliar la excepción a `SaleExtrasSummary.tsx` y pintar el crédito ahí | Arrastraría el libro de abonos al `Sale` persistido del POS y pondría el layout de dos pantallas del POS en manos de F-035 |

## Consecuencias

**A favor:**
- La marca del criterio 2 y el estado del criterio 1 se leen del mismo objeto, con una única
  definición del estado.
- Ningún permiso nuevo, y el cajero ve el estado de crédito con lo que ya puede leer.
- El listado no paga el coste del libro; el detalle lo paga solo al abrirse.
- El chip queda listo para F-036 sin un segundo componente.

**En contra / coste asumido:**
- Cuatro archivos ajenos editados por delegación. Cada uno es aditivo y está nombrado en el
  contrato, pero es superficie de conflicto si F-032 se reabriera.
- Una petición más al abrir el detalle de una venta a crédito.
- El enlace al panel del criterio 3 apunta a una pantalla que **sí** exige
  `recuperaciones.cuentasporcobrar.acceder`. Se renderiza como enlace solo cuando el permiso del
  front lo permite, y como texto plano cuando no: el nombre del deudor no se esconde, el enlace roto
  sí.

**Impacto en seguridad y escalabilidad:**
- La ruta nueva no abre un eje de tenant: resuelve la `Venta` con `withTenantScope` sobre
  `venta` y `path:tiendaId`, igual que sus tres hermanas del mismo directorio, y añade **su propia
  fila** a `src/constants/routeGuards/routeGuards.json` (el censo compara los pares (ruta, verbo)
  contra el árbol exactamente).
- Va sin permiso a propósito, por la misma razón que la GET del listado: devuelve, para una venta,
  un subconjunto de lo que esa GET ya devuelve para todas las del período. Es el punto que el
  `security-guardian` tiene que confirmar o tumbar.
- El bloque `credito` del listado se resuelve con un `include` sobre una relación `@unique` por
  venta: una fila por venta, sin N+1.
