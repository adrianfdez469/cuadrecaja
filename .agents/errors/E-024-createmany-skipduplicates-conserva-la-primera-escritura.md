# E-024: `createMany({ skipDuplicates: true })` conserva en silencio la primera escritura

**Área:** prisma
**Apariciones:** 1 — transversal (cierre de caja, ADR 0036)

## Síntoma

Un período cerrado tenía `totalVentas = 1488,23` guardado, pero su `ResumenMonedaCierre` sumaba
exactamente las ventas de otro conjunto (58 ventas en vez de 62). Dos filas escritas "en la misma
transacción de cierre" describían períodos distintos. Ningún error, ningún log.

## Causa raíz

`close/route.ts` escribía el desglose por moneda así:

```ts
await tx.resumenMonedaCierre.createMany({ data, skipDuplicates: true });
```

`skipDuplicates` convierte la violación de la clave única `(cierrePeriodoId, monedaCode)` en un
no-op. Si el período se cierra por segunda vez (solo posible tras reabrirlo a mano en la BD), el
`update` de los totales sí sobreescribe, pero el `createMany` encuentra las filas del primer
cierre y **no escribe nada**. Los totales quedan del segundo cierre y el desglose del primero.

El flag se puso para "que no falle si ya existe". Lo que consigue es que no falle **y** que no
escriba, que es peor: la segunda escritura era la correcta.

## Solución

Borrar y volver a crear dentro de la misma transacción (`persistCierreComputation`):

```ts
await tx.resumenMonedaCierre.deleteMany({ where: { cierrePeriodoId } });
await tx.resumenMonedaCierre.createMany({ data });
```

Idempotente por construcción: N ejecuciones dejan exactamente un juego de filas, siempre el de la
última. Para tablas con filas que no deben tocarse (liquidaciones ya pagadas) se filtra antes
(`mergeLiquidaciones`), no se confía en el flag.

## Cómo evitarlo

`skipDuplicates: true` solo vale cuando la fila existente y la nueva son **la misma información**
(idempotencia de inserción, p. ej. reintentos de un mismo evento). Si la nueva puede ser
distinta, es una escritura perdida disfrazada: usar `deleteMany` + `createMany`, o `upsert` por
fila. En una revisión, cada `skipDuplicates` debe poder responder "¿y si la fila existente es
vieja?".
