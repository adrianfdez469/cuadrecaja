# ADR 0133: La tercera razón de bloqueo son los cobros ya recibidos, no la deuda viva

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-037

> Este ADR resuelve una **tensión entre dos criterios de aceptación vinculantes de F-037** y fija
> los códigos HTTP de los dos DELETE. Es el ADR que hay que leer antes de tocar la guarda de
> `.../producto/[ventaProductoId]/route.ts`.

## Contexto

El dosier del epic (`.agents/cuentas-por-cobrar.md` § 4) y el campo `notes` de F-037 en
`.agents/features.json` describen la corrección así:

> «Se añade una TERCERA razón de bloqueo, con su propio motivo visible: **una venta con deuda viva
> no admite borrar productos ni borrarse**. El gate compuesto se arma en cada llamador.»

Leída literalmente, esa frase es incompatible con **tres** de los once criterios de aceptación del
propio feature, que son verbatim del backlog y no se reescriben:

- **Criterio 7** — «Borrar una venta a crédito **SIN abonos** elimina también su CuentaPorCobrar, y
  el saldo del cliente vuelve a lo que era.» Una venta sin abonos tiene, por construcción, deuda
  viva: si la deuda viva bloqueara el borrado, este criterio sería inalcanzable.
- **Criterio 8** — «Borrar un producto de una venta a crédito **SIN abonos** descuenta el ajuste
  PRIMERO del crédito… el crédito baja a 100 y el efectivo no se mueve.» Su siembra es una venta
  con `CuentaPorCobrar` viva de saldo 400, y el DELETE tiene que **completarse**.
- **Criterio 6** — «Borrar una venta a crédito que **YA tiene abonos** responde 409 nombrando
  cuántos cobros tiene y por cuánto. El dinero ya entró a la caja de otro periodo, posiblemente
  cerrado.» Aquí está escrita la razón real del bloqueo, y no es la deuda: es **el dinero que ya
  entró a una gaveta**.

El criterio 5 («con una venta a crédito de 3 productos y **saldo vivo**, el borrado de un producto
está bloqueado con su motivo… Y una llamada DIRECTA a la API… responde con el rechazo») es el que
parecía pedir lo contrario. Pero «saldo vivo» significa `settledAt IS NULL` y `saldoPendiente > 0`,
y eso es **exactamente lo que le pasa a una cuenta cobrada a medias**: un abono parcial deja saldo
vivo. El criterio 5 no dice «sin abonos» en ninguna parte; lo añadió el protocolo de verificación
del `spec` (`.agents/specs/F-037.md`, criterio 5, «Protocolo»), que es elaboración del paso 3, no
texto del backlog.

Hay un segundo hallazgo, verificado leyendo el archivo, que cambia el diagnóstico del bug 3. La
guarda de hoy es:

```ts
if (!esUltimoProducto && pagos && !pagadaConUnSoloPago(pagos))
```

El dosier y el criterio 5 afirman que el operando `pagos &&` **salta la guarda entera** cuando
`pagosDetalle` es nulo. Es verdad que la salta — y es irrelevante, porque el resultado es idéntico
al de evaluarla: `pagadaConUnSoloPago(null)` y `pagadaConUnSoloPago([])` devuelven las dos `true`
(`src/lib/currency.ts:329`, `(pagosDetalle?.length ?? 0) <= 1`), así que con o sin el
cortocircuito la condición vale `false` y el borrado procede. **`pagos &&` es peso muerto, no el
agujero.** El agujero es que «cero líneas de pago» no es una razón para bloquear nada, y hasta
F-034 no existía ninguna venta con cero líneas de pago.

## Decisión

**La tercera razón de bloqueo es «esta venta a crédito ya tiene cobros registrados», no «tiene
deuda viva».** Y se le añade una cuarta, hermana suya, para el libro ya movido por otra vía.

El gate se define **una vez**, como lógica pura en `src/lib/cuentasPorCobrar/ventaDeleteGuard.ts`
(un `.ts`, nunca un `.tsx`: un símbolo en un `.tsx` no es importable desde un test, E-015), y lo
importan los **cuatro** llamadores: los tres componentes de front y la ruta de la API. Sus razones,
en orden de evaluación —el primero que dispara gana, misma forma que
`CREDIT_INVARIANT_VIOLATIONS`—:

| Razón | Cuándo | HTTP |
|---|---|---|
| `CREDITO_CON_COBROS` | la venta tiene `CuentaPorCobrar` y sus cobros netos son > 0 | **409** |
| `CREDITO_CON_MOVIMIENTOS` | tiene `CuentaPorCobrar`, cero cobros netos, y ≥ 1 fila en el libro | **409** |
| `MULTIPLES_PAGOS` | no es el último producto y hay más de una línea en `pagosDetalle` | **400** |

`pagadaConUnSoloPago` **no se toca**: su semántica («cero o un pago») es correcta para lo que fue
escrita, y el gate la importa en vez de reimplementarla. Del operando `pagos &&` sí se prescinde,
declarando en el contrato que es **una limpieza sin cambio de comportamiento** y no la corrección
del bug: sostener lo contrario sería un absoluto que el código no aguanta (E-017).

`CREDITO_CON_MOVIMIENTOS` cubre una cuenta cuyo saldo se movió por `CONDONACION` o por
`AJUSTE_DEVOLUCION` sin que haya entrado un peso: borrar esa venta haría que la cascada borrara
filas del libro **fechadas**, y `totalPorCobrarAlCierre` de un período ya cerrado se recomputa como
«movimientos con `fecha <= fechaFin`» (dosier § 5). Es una razón más ancha que lo que cualquier
criterio de F-037 exige, y por eso está **nombrada, con su propio motivo y en la lista de
testabilidad del contrato**: una guarda más ancha que el contrato es una rama que nadie prueba
(E-032), pero una guarda que el contrato declara y el `dev-tester` cubre no lo es.

### Los códigos, caso por caso

- **409 en los dos DELETE** —el de la venta (criterio 6, que lo fija) y el del producto (criterio
  5, que lo dejaba abierto)—: es la misma pregunta con la misma respuesta. El estado del recurso lo
  impide y ninguna forma de la petición lo arregla.
- **400 se queda donde está**, en la guarda preexistente de «más de un pago» del mismo archivo. Esa
  sí es una limitación de lo que la petición puede expresar: con dos líneas de pago el servidor no
  sabe de cuál descontar, y el criterio 11 de otro feature ya se verificó contra ese 400. Que
  convivan dos códigos en un archivo no es incoherencia: **400 dice «con estos datos no se puede»,
  409 dice «con esta venta no se puede»**.
- **403 queda descartado explícitamente** para cualquiera de los dos. `axiosClient` sustituye el
  cuerpo de **todo** 403 por un error genérico de permisos (E-009), así que el motivo no llegaría a
  la pantalla y el criterio 5 —que pide el rechazo «con su motivo»— caería por el transporte.

### El atajo del último producto entra por la misma puerta

En `.../producto/[ventaProductoId]/route.ts`, con `esUltimoProducto === true` la ruta borra la
`Venta` completa dentro de su propia transacción, sin pasar por el handler `DELETE` de
`.../[ventaId]/route.ts` (hallazgo del `spec`, § «Contexto necesario»). El gate devuelve **dos
veredictos** —uno para «borrar un producto» y otro para «borrar la venta»— y la ruta consulta el
segundo cuando ese atajo se va a tomar. Sin eso, el criterio 6 se elude borrando el último
producto de una venta con abonos.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Bloquear por **deuda viva**, como dice la letra del dosier | Hace inalcanzables los criterios 7 y 8, que traen cifras exactas y son vinculantes. El `notes` del backlog es contexto; los `acceptance_criteria` son el contrato |
| Cambiar `pagadaConUnSoloPago` para que `[]`/`null` devuelvan `false` | Rompe a los otros llamadores y a las ventas legacy sin `pagosDetalle`, que hoy se pueden editar y deben seguir pudiéndose. El dosier lo prohíbe explícitamente |
| Front conservador: bloquear en el POS toda venta con `creditoBase > 0` sin mirar cobros | El motivo visible mentiría en el caso del criterio 8 y le impediría al cajero una operación que el servidor sí acepta. Un front más estricto que el servidor es una divergencia que nadie prueba |
| Una sola razón `CREDITO_BLOQUEADO` para cobros y para el libro movido | El mensaje del criterio 6 tiene que nombrar **cuántos** cobros y **por cuánto**; con cero cobros ese mensaje diría «0 cobros por 0», que es peor que no decir nada (E-016) |
| 400 también para el rechazo del criterio 5, por simetría con el vecino del archivo | La simetría sería con la guarda equivocada. La guarda vecina es de forma de la petición; esta es de estado del recurso, y el criterio 6 ya fijó 409 para el mismo estado |

## Consecuencias

**A favor:**
- Los once criterios pasan a ser simultáneamente satisfacibles, sin reescribir ninguno.
- Una sola definición del gate, en un `.ts`, importable por un test y por los cuatro llamadores.
- El atajo del último producto deja de ser un camino sin comprobaciones.
- El libro de cuentas por cobrar no pierde filas fechadas por una cascada.

**En contra / coste asumido:**
- El front necesita saber si la cuenta tiene cobros, y eso obliga a que el dato viaje en la venta
  serializada y en el `Sale` del POS (ADR 0134). Un `Sale` local sin sincronizar no trae el bloque
  y el gate lo lee como «sin cobros», que es correcto: su cuenta todavía no existe.
- `CREDITO_CON_MOVIMIENTOS` es una razón que ningún criterio ejercita; vive del test que el
  contrato le exige al `dev-tester`.
- Queda escrito para siempre que el diagnóstico «`pagos &&` salta la guarda» era cierto y a la vez
  inocuo. Quien lea solo el dosier creerá que quitarlo arregla algo.

**Impacto en seguridad y escalabilidad:**
- El gate del front es UX; la defensa es la ruta, y el criterio 5b la comprueba llamando al
  endpoint sin pasar por ningún botón.
- Ninguna consulta nueva sale del eje de tenant: los cobros se leen a través de la `Venta` que las
  tres rutas ya validan contra `negocioId`.
- El conteo de cobros de una venta es un `include` acotado por `ventaId`, con la cuenta en relación
  `@unique`: no hay N+1 ni crecimiento sin cota en las rutas de borrado.
