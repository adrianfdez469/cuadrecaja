# ADR 0126: El panel lee el saldo denormalizado, agrega en memoria y no pagina

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-035 (panel de cuentas por cobrar y registro de cobros)

> Tres decisiones de la misma consulta: **qué cifra se lee** como saldo vivo, **dónde se aplica el
> corte de antigüedad**, y **por qué el listado no pagina en servidor**. La tercera es una deuda
> asumida a propósito, con el umbral en el que hay que pagarla escrito aquí.

## Contexto

El listado del panel responde, por deudor: cuánto debe, con qué antigüedad, cuándo fue su último
abono y en qué estado está. Hay dos formas de saber cuánto debe una cuenta.

`computeSaldoAlCierre` (`src/lib/cuentasPorCobrar/saldo.ts`) la recompone desde el libro:
`montoOriginal` más la suma con signo de sus movimientos. Es la **definición** del saldo, y el
comentario de la columna en `prisma/schema.prisma` lo dice sin rodeos: *«DENORMALIZED:
montoOriginal minus the signed sum of its movements. computeSaldoAlCierre is the definition; this
column is a cache of it.»* Es lo que usa el motor de cierre, que necesita el saldo **a un corte**
—`fecha <= fechaFin`— y por tanto no puede leer una columna que refleja el ahora.

`CuentaPorCobrar.saldoPendiente` es esa caché. Es lo que `loadSaldoPorCliente` (F-033) ya lee para
la columna de saldo de la lista de clientes, con un solo `groupBy`.

La antigüedad tiene una única definición en el proyecto: `AGING_BUCKETS` y su intérprete
`bucketAntiguedad` (`src/lib/cuentasPorCobrar/aging.ts`), cuyo docstring se declara *«THE ONLY
definition of the brackets in the project (E-014)»*. El criterio 2 filtra por tramo —`31-60` no
puede devolver ni una deuda de 30 días ni una de 61—, y ese filtro tiene que salir de ahí.

El problema es dónde se aplica. Un filtro en SQL exige traducir el tramo a un rango de fechas, y
esa traducción es un **segundo intérprete** de los mismos cortes: exactamente la forma de E-014,
con la agravante de que los dos intérpretes acertarían en los casos de en medio y discreparían solo
en los bordes, que son los que el criterio prueba.

Y por último el volumen. El listado agrupa por cliente, y la agrupación necesita todos los saldos
del cliente para sumar y para escoger la antigüedad mayor: paginar las **cuentas** daría filas de
deudor incompletas.

## Decisión

**1. El panel lee `CuentaPorCobrar.saldoPendiente`; no recompone el saldo desde el libro.**

Es la vista del **ahora**, que es justo lo que la columna cachea. El motor de cierre sigue usando
`computeSaldoAlCierre` porque necesita un corte histórico, y las dos lecturas no compiten: una
responde «cuánto debe hoy» y la otra «cuánto debía el 31 de agosto».

Lo que sostiene esta decisión es el ADR 0123: **toda escritura del libro pasa por
`applyMovimientoCuentaPorCobrar`, que actualiza la columna en la misma transacción**. Si esa puerta
deja de ser única, la columna deriva y el panel miente. Es la razón de que el dosier § 5 pida un
`scripts/recalculate-cuentas-por-cobrar.ts` de reparación — que **no** es de este feature.

**2. El corte por antigüedad se aplica en memoria, con `bucketAntiguedad`.**

La ruta empuja a SQL lo que se puede expresar sin reinterpretar nada —tienda, cliente, estado,
tenant— y clasifica los tramos en memoria llamando a `daysOutstanding` + `bucketAntiguedad` sobre
cada cuenta viva. El instante de medida (`at`) se calcula **una vez** en la ruta y se pasa como
parámetro, nunca se lee dentro de la agregación: es la trampa del dosier § 7 —con `Date.now()`
dentro, dos filas de la misma respuesta podrían caer en tramos distintos— y es la propiedad que
`buildCuentasPorCobrarSnapshot` ya protege con su `at`.

**3. El listado no pagina en servidor.** Devuelve una fila por cliente del negocio que tenga al
menos una `CuentaPorCobrar`, y el número total en la respuesta. Las cuentas que se cargan enteras
son solo las **vivas** (`settledAt IS NULL`, sobre el índice `[tiendaId, settledAt]`); el universo
de deudores sale de un `groupBy` por `clienteId` que no trae filas. Es el mismo tamaño de respuesta
que `GET /api/clientes` ya devuelve, con su `CLIENTES_LIST_LIMIT` de 500.

**El umbral en el que esto deja de valer, escrito por adelantado:** cuando un negocio pase de unos
cientos de cuentas vivas, o cuando la respuesta del listado supere el orden de magnitud de la de
`/api/clientes`. En ese punto hay que paginar **por cliente**, no por cuenta, y el corte por
antigüedad tendrá que bajar a SQL — y entonces `bucketAntiguedad` deja de poder ser el único
intérprete y hace falta un derivador de rangos que **lea `AGING_BUCKETS`**, no que repita 30/60/90.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Recomponer el saldo del panel con `computeSaldoAlCierre`** | Obliga a cargar **todos los movimientos de todas las cuentas vivas** para pintar una lista. Es la consulta que más crece del feature y no compra nada: si la columna y el libro discrepan, el bug está en la puerta de escritura y hay que arreglarlo ahí, no compensarlo en cada lectura |
| **Traducir el tramo de antigüedad a un rango de `fechaVenta` en el `where`** | Un segundo intérprete de `AGING_BUCKETS` (**E-014**), y el peor tipo: acierta en los casos de en medio y solo puede discrepar en los bordes exactos —30, 31, 60, 61—, que son los que el criterio 2 prueba. Se difiere al momento en que el volumen lo exija, y entonces el derivador **leerá** la constante |
| **Paginar por cuenta** | Rompe la agrupación: un deudor con seis cuentas partidas entre dos páginas aparece dos veces con la mitad de su saldo cada vez. La fila del listado es el **cliente**, no la cuenta |
| **Devolver solo deudores con saldo vivo, y así no cargar nunca lo saldado** | Sería la respuesta más pequeña, y deja el criterio 1 sin verificar: su protocolo siembra explícitamente «uno completamente saldado (para el valor de estado que no es con deuda)». Sin esas filas, la columna `estado` tendría un solo valor posible y sería decorativa (**E-013**) |
| **Paginar desde el primer día** | Trabajo que ningún criterio pide, sobre una agregación que hay que hacer entera antes de poder ordenar por saldo. Se asume la deuda con su umbral escrito, que es lo que la hace una decisión y no un olvido |

## Consecuencias

**A favor:**

- Tres consultas por listado, ninguna con N+1: el universo de deudores (`groupBy` por `clienteId`),
  las cuentas vivas con sus columnas, y el último abono por cuenta (`groupBy` con `_max: { fecha }`).
  Ningún movimiento se carga para pintar la lista.
- Los tramos de antigüedad siguen teniendo **un** intérprete, y es el que F-031 declaró como tal.
- El instante de medida viaja en la respuesta, así que el `qa` puede reproducir la clasificación en
  vez de deducirla.

**En contra / coste asumido:**

- **El panel hereda la exactitud de `saldoPendiente`.** Si alguien escribe el libro por fuera de la
  puerta única, el panel muestra la cifra equivocada y nada lo señala. Es el mismo riesgo que ya
  corre la columna de saldo de la lista de clientes, y su mitigación —el script de recálculo— sigue
  sin dueño.
- **El listado crece linealmente con los deudores del negocio, sin tope.** Está escrito arriba
  cuándo hay que pagarlo. Un negocio que fíe a diario a cientos de clientes lo va a notar antes que
  el resto.
- **El filtro de antigüedad recorre en memoria las cuentas vivas del negocio** aunque devuelva tres
  filas. Con el volumen de hoy es despreciable; con el volumen del umbral, es la primera cosa que
  hay que bajar a SQL.

**Impacto en seguridad y escalabilidad:**

- **Seguridad:** las tres consultas se arman con `withTenantScope("cuentaPorCobrar", …, negocioId)`
  o `withTenantScope("cliente", …)`, que resuelven el camino al `negocioId` desde
  `TENANT_RELATION_PATH` y no a mano. La agregación en memoria opera **solo** sobre filas que ya
  salieron de una consulta con esa cláusula: no hay ningún camino por el que una fila ajena entre
  al agregador.
- **Escalabilidad:** descrita arriba, con su umbral. El coste dominante es la lectura de cuentas
  vivas, apoyada en `@@index([tiendaId, settledAt])`.
- **Reversión:** añadir paginación después no cambia ninguna firma del agregador puro —recibe filas
  y devuelve filas—; cambia la ruta y el contrato de la respuesta. Es reversible y localizado.
