# E-028: Un ciclo de valor entre dos módulos de schemas no lo ve el compilador

**Área:** build
**Apariciones:** 1 — F-007

## Síntoma

`npx tsc --noEmit` daba **exit 0**. `npm test` tumbaba cuatro archivos de tests que no tenían
nada que ver con el feature en curso:

```
TypeError: Cannot convert undefined or null to object
 ❯ Module.getEnumValues node_modules/zod/v4/core/util.js:14:34
 ❯ src/schemas/qabAvailability.ts:81:14   outcome: z.enum(QAB_BUSINESS_OUTCOMES),
Test Files  4 failed | 83 passed
```

Los cuatro rojos eran `outboxAck`, `qabCatalogClient`, `qabSync` y `slugLearn` — suites que ya
estaban en verde y que no tocaba nadie.

## Causa raíz

El contrato de interfaces prescribía dos imports que, por separado, son razonables:

- `src/schemas/qabSync.ts` importa `qabAvailabilityPhaseReportSchema` de `qabAvailability.ts`.
- `src/schemas/qabAvailability.ts` importa `QAB_BUSINESS_OUTCOMES` de `qabSync.ts`.

Juntos son un **ciclo de valor** entre dos módulos que evalúan schemas Zod **en el tope**. El
módulo que se evalúa segundo ve el binding del primero todavía sin inicializar, así que
`z.enum(undefined)` revienta al **cargar** el módulo, no al ejecutar una aserción.

Dos agravantes que hacen que se escape:

1. **`tsc` no lo ve.** Los tipos circulares sí resuelven; es el *valor* el que no está listo. Un
   `--noEmit` limpio no dice nada sobre esto (la otra cara de [E-026](E-026-la-suite-en-verde-no-implica-tsc-limpio.md)).
2. **El daño es colateral y desproporcionado.** Al fallar en la fase de colección, se lleva por
   delante archivos enteros ajenos al cambio, igual que
   [E-019](E-019-it-each-con-un-simbolo-que-aun-no-existe.md). El rojo aparece lejos de la causa.

## Solución

Cortar la arista bajando **la constante** —no el schema— a `src/constants/`, que es además donde
`AGENTS.md` manda las cadenas compartidas, y **re-exportarla** para no propagar el corte:

```ts
// src/constants/qab.ts  — la declaración vive aquí
export const QAB_BUSINESS_OUTCOMES = [...] as const;

// src/schemas/qabSync.ts — re-exporta, así ningún consumidor cambia su import
export { QAB_BUSINESS_OUTCOMES };

// src/schemas/qabAvailability.ts — única línea que cambia
import { QAB_BUSINESS_OUTCOMES } from "@/constants/qab";
```

`import { QAB_BUSINESS_OUTCOMES } from "@/schemas/qabSync"` sigue siendo válido para todos los
consumidores y para los tests ya escritos.

## Cómo evitarlo

Cuando un contrato (o un refactor) haga que **A importe un valor de B y B un valor de A**, y los
dos módulos evalúen algo en el tope —schemas Zod, `z.enum`, tablas derivadas—, cortar la arista
**antes de escribir el código**: la constante compartida baja a `src/constants/`, nunca el schema,
y el módulo que la exponía la re-exporta.

Y en la revisión de un contrato: dos imports que por separado parecen razonables pueden no cargar
juntos. El compilador no es la red aquí — la red es correr la suite **entera**, porque el síntoma
aparece en archivos que el cambio no toca.
