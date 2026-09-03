# ADR 0024: `qabTokenConfigurado` se deriva con un `where`, sin que el token salga de la base

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-003
**Se apoya en:** [ADR 0006](0006-qabtoken-invisible-por-defecto.md) ·
[ADR 0013](0013-lectura-del-qabtoken-con-select-explicito.md) ·
[ADR 0019](0019-select-explicito-y-403-en-las-rutas-de-negocio.md)

## Contexto

F-003 es el primer feature que **guarda** el `qabToken` de verdad y el primero que construye una
pantalla alrededor de él. Toda su superficie de lectura es, por decisión del humano, dos campos:
`qabTokenConfigurado` (booleano) y `qabTokenActualizadoAt`. Nada derivado del valor — ni los
últimos cuatro caracteres, que se llegaron a considerar y quedaron derogados.

La forma evidente de producir ese booleano es traerse el token y compararlo:

```ts
const row = await prisma.negocio.findUnique({
  where: { id },
  select: { id: true, tiendaOnlineHabilitada: true, qabToken: true, qabTokenActualizadoAt: true },
});
return { ...row, qabTokenConfigurado: row.qabToken !== null };  // ← y el token en memoria
```

Funciona, y es una trampa de las que no se ven en revisión. Cuatro hechos que se componen mal:

1. **Un `select` explícito vence al `omit` global** (ADR 0013, verificado ejecutando en F-002). La
   defensa del ADR 0006 no protege contra una consulta que pide el token a propósito.
2. El objeto queda con el secreto dentro, en el proceso de una ruta HTTP cuya única misión es
   responder un booleano. A partir de ahí, un `NextResponse.json(row)`, un spread de más o un
   `console.log` de depuración lo publican. Es exactamente el fallo que el ADR 0019 describe para
   `GET /api/negocio`, un escalón más abajo.
3. **En la ruta de lista es peor**: la pantalla de `/configuracion/negocios` muestra **todos** los
   negocios de la plataforma. La consulta traería a memoria **todos los tokens del sistema** para
   calcular una columna de sí/no.
4. `qabPrisma` tiene un tipo ancho por un *cast* deliberado (ADR 0015), así que un `findUnique`
   descuidado compila igual y devuelve `qabToken` undefined en silencio. El compilador no ayuda.

El ADR 0013 dejó anotado, verificado, el detalle que resuelve esto: **un `where` sobre una columna
omitida funciona con normalidad y no la devuelve.** Es como el cron elige los negocios candidatos
sin que el secreto salga de Postgres.

## Decisión

**Ninguna ruta de F-003 lee el valor del `qabToken`. El booleano se deriva con un `where`.**

```ts
// src/lib/negocio/qabSettings.ts
export const NEGOCIO_QAB_SELECT = {
  id: true,
  tiendaOnlineHabilitada: true,
  qabTokenActualizadoAt: true,
} satisfies Prisma.NegocioSelect;      // ⚠ `qabToken` deliberadamente AUSENTE

/** Ids que tienen token, sin leer ninguno. */
export async function loadNegocioIdsWithQabToken(tx, negocioIds?) {
  const rows = await tx.negocio.findMany({
    where: { qabToken: { not: null }, ...(negocioIds ? { id: { in: negocioIds } } : {}) },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}
```

Y la función que arma la forma del cable **no recibe el token**, recibe si lo hay:

```ts
export function toNegocioQabSettings(
  row: INegocioQabRow,
  tokenConfigurado: boolean,
): INegocioQabSettingsItem;
```

Es la misma idea que el ADR 0023 aplica al log: donde el secreto no es un parámetro, la fuga no es
improbable, es **imposible**. Los criterios 5, 14 y 15 dejan de depender de que alguien recuerde
proyectar bien y pasan a depender de la forma de las firmas.

**La escritura sí nombra la columna** —`update({ data: { qabToken, qabTokenActualizadoAt } })`—
pero su `select` de retorno es `NEGOCIO_QAB_SELECT`, que no la incluye.

### La invariante auditable

Después de este feature, esto sigue devolviendo **exactamente una línea**:

```bash
grep -rn "qabToken: true" src/ | grep -v "omit:"   # → exactamente 1: outboxDrain.ts
```

Un único lector del valor en todo el repositorio, el que el ADR 0013 designó. Cualquier línea nueva
que aparezca ahí es una decisión que hay que justificar, no un descuido que hay que descubrir.

**El filtro `grep -v "omit:"` es parte del comando, no una comodidad.** Sin él devuelve **tres**
líneas ya hoy, con F-003 sin empezar:

```
src/lib/prisma.ts:10:        omit: { negocio: { qabToken: true } },   ← la defensa (ADR 0006)
src/lib/qab/qabPrisma.ts:32: omit: { negocio: { qabToken: true } },   ← la defensa (ADR 0006)
src/lib/qab/outboxDrain.ts:80: select: { id: true, qabToken: true },  ← el único lector
```

Como cadena de texto, `omit: { qabToken: true }` («ocúltalo») y `select: { qabToken: true }`
(«léelo») son indistinguibles, y significan exactamente lo contrario. Las dos primeras líneas son
el `omit` global que hace invisible la columna: **descartarlas del recuento es lo correcto, y
borrarlas del código sería desmontar el ADR 0006**.

Se escribe aquí porque el riesgo de un comando de auditoría mal calibrado no es que falle: es que
quien lo ejecute y vea un número que no cuadra o dé por rota una invariante que está sana, o se
acostumbre a que «siempre da de más» y deje de mirar el día que aparezca una cuarta línea de
verdad. Una auditoría en la que no se confía es peor que ninguna. **Verificado ejecutando** contra
el repositorio el 2026-09-03, antes y después del filtro.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `select: { qabToken: true }` y descartarlo en una función pura | Es la opción evidente y la que un implementador escribiría solo. Deja el secreto en memoria de rutas que no lo necesitan y, en la lista, **todos** los tokens de la plataforma a la vez, para calcular una columna de sí/no |
| Añadir una columna `qabTokenConfigurado` materializada | Un booleano copiado se desincroniza del valor que describe, y hace falta una migración. La verdad ya está en la columna; el problema nunca fue calcularla |
| `$queryRaw` con `qabToken IS NOT NULL AS configurado` | Una consulta en crudo se salta el tipado y —peor— se salta el `grep` que audita el ADR 0006. Es justo el camino que el ADR 0013 descartó por lo mismo |
| Una vista de Prisma o un campo calculado en el cliente | Prisma no tiene campos calculados sin extensión, y una extensión del cliente añade un punto donde el `omit` global podría desactivarse sin que se note |
| Dejarlo en una sola consulta aceptando el coste | El coste que se evita no es de rendimiento, es de exposición. La consulta extra es un `select id` sobre `Negocio`, que en esta pantalla tiene decenas de filas |

## Consecuencias

**A favor:**
- Los criterios 5, 14 y 15 se cumplen **por construcción**: el token no sale de Postgres en ningún
  camino de este feature, así que no puede estar en una respuesta, en el HTML servido ni en una
  traza.
- El criterio 15 (el HTML crudo) queda cerrado sin ninguna medida específica: lo que no sale de la
  base no puede estar en el payload de RSC.
- La auditoría del ADR 0006 sigue siendo un `grep` de una línea, y ahora tiene un número esperado
  **y calibrado contra el repositorio real**, no supuesto.
- La superficie que `security-guardian` tiene que revisar es una constante y dos funciones, no
  cuatro rutas.

**En contra / coste asumido:**
- **Una consulta más** por respuesta (el `select id` de los que tienen token). Asumido: es la
  pantalla de administración de plataforma, con decenas de filas, y el índice de clave primaria la
  resuelve.
- Dos lecturas no son atómicas: entre la proyección y el conjunto de ids podría colarse una
  escritura y el booleano venir de un instante ligeramente distinto de la fecha. Irrelevante aquí
  —el peor caso es una pantalla que muestra un estado de hace milisegundos y se corrige al
  recargar— y no vale la pena una transacción por ello.
- Hay que resistir la tentación de «optimizar» juntando las dos consultas. Este ADR es la respuesta
  a esa propuesta.

**Impacto en seguridad y escalabilidad:**
- **Un único lector del valor del token en todo el repositorio**, verificable con un comando.
- **Aislamiento:** `loadNegocioIdsWithQabToken` acepta un filtro de ids y las rutas por negocio lo
  usan con el id del path, así que ni siquiera el conjunto de «quién tiene token» se calcula más
  ancho de lo necesario.
- Escalabilidad: las dos consultas son proyecciones estrechas sobre `Negocio`, la tabla más pequeña
  del sistema. Nada aquí crece con las ventas ni con los movimientos.
- Reversión: es la forma de escribir dos consultas. Sin datos ni migraciones que deshacer.
