# ADR 0123: Las dos cifras de flujo entran en los totales almacenados; el stock no gana fila

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-034 (el crédito en el cierre y en el resumen de cierres)

## Contexto

`CierrePeriodo.totalCreditoOtorgado`, `totalCobrosCredito` y `totalPorCobrarAlCierre` existen desde
F-029 y el motor de F-030 las escribe en cada cierre y en cada recálculo
(`computeCierreTotals.ts:750-752`, persistidas por `persistCierreTotals`). Hasta ahora viajaban en
el JSON de las respuestas **sin tipo declarado**, porque `src/schemas/cierre.ts` es de F-034
(F-030 § 0.2).

`src/schemas/cierre.ts` tiene un schema que no es un espejo cualquiera:
`cierreStoredTotalsSchema` es el espejo Zod de `CierreStoredTotals`, el tipo que el motor devuelve
y que la respuesta de `POST /api/cierre/[tiendaId]/[cierreId]/recalculate` usa para `before` y
`after`. Y `RecalcularCierreDialog` construye su tabla de comparación iterando

```ts
const ROWS: { key: keyof ICierreStoredTotals; label: string }[] = [ … ];
```

Es decir: **lo que no esté en ese schema no puede compararse antes/después en el diálogo de
recálculo**, porque su `key` no existe en el tipo. Y una columna que un recálculo reescribe sin
decirlo es la forma exacta de E-013 (una columna que nadie recomputa usada como si estuviera al
día) con E-024 encima (la segunda escritura deja los totales nuevos y el desglose viejo): las dos
cifras envejecerían en silencio y nadie tendría cómo notarlo.

La alternativa era dejarlas como columnas de la tabla del histórico sin entrar en el schema —menos
superficie, y el criterio 9 pasaría igual—.

## Decisión

**Las tres cifras entran en `cierreStoredTotalsSchema` como campos requeridos, y el diálogo de
recálculo gana exactamente dos filas: `totalCreditoOtorgado` y `totalCobrosCredito`.**

- **Las tres en el schema, no dos.** El schema es el espejo de `CierreStoredTotals`, donde las tres
  son requeridas; dejar una fuera dejaría el espejo roto y `before` mal tipado. Y no hay riesgo de
  ruptura en caliente: nadie hace `parse` con este schema, se usa solo como origen de tipos
  (verificado con un `grep` sobre `src/`), y tanto `before` —construido desde un `select` que ya
  trae las tres, F-030 § 6.3— como `after` —`computation.totals`— las llevan pobladas.
- **Dos filas en `ROWS`, no tres.** `totalPorCobrarAlCierre` es un **stock**: el saldo de la tienda
  en `fechaFin` sumando todos los períodos. Una columna `before`/`after` con su delta al lado de
  dos flujos invita a leerlo como un tercer flujo y a sumarlo con ellos. Su idempotencia bajo
  recálculo ya la verifica F-030 (su criterio 9), que es donde vive el motor que la calcula.
- **Consecuencia buscada:** las dos filas nuevas se escriben añadiendo dos entradas al array. No
  hay que tocar `buildRows`, ni `resumenChanges`, ni el `EPSILON` del diálogo, que ya operan
  genéricamente sobre `before[key]`/`after[key]`. El criterio 11 de F-034 sale de ahí.
- **En el resumen del histórico solo se suman las dos de flujo** (`sumTotalCreditoOtorgado`,
  `sumTotalCobrosCredito`). `totalPorCobrarAlCierre` **no se añade al `_sum`** del `aggregate`:
  sumar un stock entre períodos cuenta la misma deuda una vez por período. Viaja por fila, como ya
  viajaba.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dejar las dos cifras fuera de `cierreStoredTotalsSchema` y pintarlas solo como columnas | Son entonces dos columnas que el recálculo reescribe y que nadie compara: E-013 con E-024 encima. El criterio 9 pasaría igual y el problema aparecería meses después, sin síntoma |
| Meter solo las dos de flujo en el schema y dejar el stock fuera | Rompe el espejo con `CierreStoredTotals`, que declara las tres requeridas, y deja `before` mal tipado en el recálculo |
| Añadir también `totalPorCobrarAlCierre` a `ROWS` | Un stock con un delta al lado se lee como un flujo. Su idempotencia es de F-030 y ya está verificada allí |
| Sumar `totalPorCobrarAlCierre` en el resumen | Cuenta la misma deuda N veces (dosier § 6, F-030 § 3.3.e) |

## Consecuencias

**A favor:**

- Un recálculo que cambie cualquiera de las dos cifras lo dice, en la misma tabla y con el mismo
  mecanismo que ya usa para las nueve de siempre.
- Las tres cifras dejan de viajar sin tipo. `ICierrePeriodo`, `ICierreData` e `ICierreStoredTotals`
  describen por fin lo que la API devuelve de verdad.
- El coste de mantenimiento de las filas nuevas es cero: cualquier cifra que en el futuro entre en
  el schema aparece sola en `before`/`after` en cuanto alguien le añada su fila.

**En contra / coste asumido:**

- `ICierreStoredTotals` gana un campo (`totalPorCobrarAlCierre`) que ninguna pantalla pinta en v1.
  Es deuda declarada, no una columna huérfana: tiene escritor verificado y su lector es el panel de
  F-033.
- Las dos columnas del histórico y las dos filas del diálogo tienen que llevar el mismo label; si
  no, el usuario que recalcula no reconoce qué cifra está comparando. El copy de las cuatro sale
  del mismo módulo.

**Impacto en seguridad y escalabilidad:**

- Las dos claves nuevas del `_sum` viajan en el `aggregate` que ya se ejecuta dentro del
  `Promise.all` de la ruta: no se emite ninguna consulta nueva.
- Ninguna de las tres cifras estrena permiso: viajan en el JSON sin gate por la decisión ya cerrada
  de F-030 § 6.2.1, que este ADR no reabre.
