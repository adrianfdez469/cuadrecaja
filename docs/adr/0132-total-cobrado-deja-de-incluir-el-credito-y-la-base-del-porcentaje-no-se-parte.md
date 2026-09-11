# ADR 0132: «Total cobrado» deja de incluir el crédito, y la base del porcentaje no se parte en dos

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-037 (el crédito en los reportes de operación y rentabilidad)
**Se apoya en:** [ADR 0131](0131-el-credito-es-un-campo-obligatorio-de-la-venta-normalizada-y-se-comprueba-antes-de-la-rama-legado.md) ·
[ADR 0104](0104-el-credito-es-una-columna-no-una-linea-de-pago.md) ·
[ADR 0125](0125-la-nota-del-credito-no-reutiliza-note-y-los-criterios-se-anclan-en-data-testid.md) ·
[E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md) ·
[E-011](../../.agents/errors/E-011-medir-el-contenedor-equivocado-de-mui.md)

## Contexto

`PaymentMixResult.totalBase` es la suma de todas las filas del mix. Hoy cumple **dos papeles a la
vez** y funciona porque hasta ahora coincidían:

1. Es el denominador de `participacionPorcentaje` de cada fila.
2. Es lo que `src/app/reportes/operacion/page.tsx` pinta en la tarjeta **«Total cobrado»** del
   `StatStrip`, y también el denominador de las notas «% del total» de las tarjetas «Efectivo» y
   «Transferencia».

En cuanto el ADR 0131 mete la fila `credito` en el mix, los dos papeles dejan de coincidir. El
criterio 2 de F-037 **exige** que los porcentajes se calculen sobre una base que incluya el crédito
—contado 50 % + crédito 50 % = 100 %—, y esa misma base, puesta bajo la etiqueta «Total cobrado»,
afirma que entró a caja dinero que no entró.

Es el mismo defecto que el dosier §8 advierte para la línea «Ventas a crédito» del desglose de
cierre —y que el ADR 0122 resolvió allí explicando la cifra en vez de corregirla—, pero aquí no hay
nada que explicar: el nombre de la tarjeta es una afirmación aritmética sobre lo que hay en la
gaveta, y sería falsa.

Ninguno de los ocho criterios de aceptación de F-037 obliga a arreglarlo. Esa es precisamente la
razón por la que se decide a propósito: sin decisión, queda resuelto por accidente, inflando el KPI
en silencio, que es el mismo tipo de fallo que el resto del feature existe para eliminar en la tabla
de al lado.

## Decisión

**`PaymentMixResult` gana un segundo total, `totalCobradoBase`, y la tarjeta «Total cobrado» lo lee.
`totalBase` se queda como está y sigue siendo la base de los porcentajes.**

- `totalCobradoBase` = suma de `montoBase` de **toda fila cuyo `tipo` no sea
  `PAYMENT_MIX_CREDIT_TYPE`**.
- `totalBase` no cambia de definición ni de valor respecto a lo que el ADR 0131 establece: todas las
  filas, crédito incluido. `participacionPorcentaje` se sigue calculando sobre él.
- `operationsReportResponseSchema.pagos` gana `totalCobradoBase: z.number()`. La route handler de
  `/api/reportes/[tiendaId]/operacion` añade una línea para pasarlo.
- La tarjeta «Total cobrado» lee `pagos.totalCobradoBase`. **Las notas de porcentaje de «Efectivo» y
  «Transferencia» siguen dividiendo por `totalBase`**, para que digan exactamente lo mismo que la
  columna «Participación» de la tabla de abajo.
- Se añade una tarjeta de crédito, condicionada a que el período tenga crédito
  (`hasCreditKpi`, media centésima — el mismo umbral que F-034 ya definió y que se **importa**, no
  se reescribe). El mismo patrón condicional que `IncomeStatementTable` usa para el bloque
  «Inversión».
- Las cifras de las tarjetas llevan `data-testid` de `REPORTS_CREDIT_TEST_IDS`, puestos **en la
  página**, envolviendo el `ReactNode` que `Stat.value` ya acepta. `src/components/StatStrip.tsx`
  **no se toca**: lo importan 26 archivos y no es de este feature.

### Por qué la guarda se escribe como «no es la fila de crédito» y no como «es cash o transfer»

Las dos condiciones dan lo mismo hoy, y la diferencia importa mañana. Las filas del mix las crea
`add()`, que se llama desde exactamente cuatro sitios: el bucle de `pagosDetalle`, las dos
reconstrucciones legado desde `totalcash`/`totaltransfer`, y la fila de crédito del ADR 0131. Los
tres primeros son dinero que llegó a la gaveta. «Todo lo que no es la fila sintética de crédito es
dinero físicamente recibido» es por tanto **la definición**, mientras que enumerar `cash` y
`transfer` es una lista que habría que mantener sincronizada a mano con `pagoLineaSchema` y que
dejaría fuera, en silencio, cualquier método de pago futuro.

E-032 avisa contra la guarda más ancha que el contrato. Aquí la formulación por definición no es
más ancha: es la que el contrato enuncia, y la enumeración es la que coincide con ella por accidente.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| No hacer nada: dejar «Total cobrado» sumando el crédito | Reintroduce, en la tarjeta contigua, el mismo fallo silencioso que el feature elimina en la tabla. Y lo hace en una cifra que alguien usa para cuadrar la gaveta |
| Renombrar la tarjeta a algo que no prometa «cobrado» | La cifra seguiría siendo un total sin utilidad operativa, y el número mal sigue estando en el JSON y en la exportación. Además convierte un defecto aritmético en un problema de redacción, que es lo que E-016 enseña a no hacer |
| Sacar el crédito de `totalBase` y calcular los porcentajes sobre otra cosa | Rompe el criterio 2: los porcentajes volverían a calcularse sobre una base que no incluye el crédito, que es el bug que el feature corrige |
| Calcular `totalCobradoBase` en la página, filtrando el mix | Funciona, pero deja la definición de «dinero que entró» en un `.tsx`, donde no es importable desde un test (E-015) y donde el JSON del endpoint sigue sin ofrecerla a quien lo consuma |
| Enumerar `cash` y `transfer` en la guarda | Coincide hoy y hay que mantenerla a mano contra `pagoLineaSchema`. La definición correcta es «no es la fila sintética» |
| Que las notas de porcentaje dividan por `totalCobradoBase` | La tarjeta y la tabla darían dos porcentajes distintos para la misma fila `cash` en la misma pantalla. Peor que el defecto que se corrige |

## Consecuencias

**A favor:**

- «Total cobrado» vuelve a significar lo que dice, con crédito o sin él.
- Los porcentajes del mix suman 100 sin partir en dos el campo que los alimenta.
- La cifra de dinero realmente recibido queda disponible en el JSON del endpoint, no solo en pantalla.
- Las afirmaciones de los criterios sobre el DOM se anclan en `data-testid` y no en copy, que el
  `ui-designer` todavía no ha escrito (ADR 0125, E-011).

**En contra / coste asumido:**

- El mismo período muestra ahora dos totales distintos en la misma pantalla: el de la tarjeta y el
  denominador de la tabla. Es correcto y es exactamente lo que el crédito introduce en el negocio,
  pero hay que explicarlo en pantalla — y ese texto es del `ui-designer`.
- La tarjeta «Efectivo» puede leerse como el 50 % del total mientras es el 100 % de lo cobrado. El
  número es correcto en ambas lecturas; la que hace el lector la fija el copy.
- Una tarjeta más en el `StatStrip` cuando hay crédito, con el efecto de layout que eso tenga en
  móvil. Es del `ui-designer`.

**Impacto en seguridad y escalabilidad:**

- `totalCobradoBase` se calcula en el mismo `reduce` final sobre una lista que tiene tantas
  entradas como pares (tipo, moneda) observados: una decena como mucho. Coste nulo.
- Ninguna consulta nueva, ningún campo nuevo en base de datos, ninguna ruta nueva. Reversible
  borrando un campo del schema y una línea de la página.
