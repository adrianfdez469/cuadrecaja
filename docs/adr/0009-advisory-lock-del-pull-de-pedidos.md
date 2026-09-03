# ADR 0009: Clave y alcance del advisory lock del pull de pedidos

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-002 (la ranura), F-010 (la rellena)

## Contexto

El contrato de queandabuscando es explícito en `§③④`:

> *"Este endpoint asume un único poller por negocio, secuencial. La lectura (`findMany`) y la marca
> como `PULLED` (`updateMany`) no son atómicas entre sí. Dos pollers del mismo negocio corriendo a
> la vez pueden leer el mismo pedido antes de que el primero lo marque, y ambos lo entregarían: el
> POS lo vería duplicado. Es responsabilidad de cuadrecaja no correr dos instancias del poller de
> un mismo negocio en paralelo."*

Y los crons de Vercel **sí se solapan**: si una corrida tarda más de los 2 minutos del intervalo, la
siguiente arranca encima. La exclusión mutua no es opcional y no puede vivir en memoria del proceso,
porque en Vercel cada invocación es un proceso distinto. Tiene que vivir en la base, que es lo único
compartido.

Postgres ofrece advisory locks, pero plantean dos preguntas que no tienen respuesta obvia:

1. **La clave es un entero de 64 bits y `Negocio.id` es un UUID en texto.** Hay que derivarla.
2. **Hay dos familias de función**: las de sesión (`pg_try_advisory_lock`) y las de transacción
   (`pg_try_advisory_xact_lock`). La diferencia importa muchísimo con un pool de conexiones.

Restricción adicional del harness: el criterio 6 tiene que ser **verificable hoy**, cuando el pull
todavía no existe, y F-010 tiene que poder rellenarlo **sin cambiar la interfaz**.

## Decisión

**Clave de 64 bits derivada en TypeScript, y lock de ámbito de transacción.**

```ts
export function qabOrderPollLockKey(negocioId: string): bigint {
  return createHash("sha256")
    .update(QAB_ORDER_POLL_LOCK_NAMESPACE + negocioId)   // "qab:order-poll:"
    .digest()
    .readBigInt64BE(0);
}
```

```ts
await prisma.$transaction(async (tx) => {
  const [row] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${key}) AS acquired`;
  if (!row.acquired) return { acquired: false, value: null };
  return { acquired: true, value: await run(tx) };
}, { timeout: QAB_ORDER_POLL_TX_TIMEOUT_MS, maxWait: QAB_ORDER_POLL_TX_MAX_WAIT_MS });
```

Tres piezas de la decisión, cada una con su porqué:

**El prefijo de espacio de nombres no es decorativo.** El espacio de advisory locks es **global a la
base de datos**, compartido con cualquier otro uso presente o futuro. Hashear el UUID pelado haría
que dos usos distintos con el mismo id colisionaran. `"qab:order-poll:"` los separa.

**La derivación se hace en TypeScript y no en SQL** (`hashtextextended`) para que sea una **función
pura y comprobable en la suite de Vitest**, que es la única capa de tests automáticos del proyecto.
Los vectores dorados quedan fijados en el contrato de interfaces y en los tests: si alguien cambia
la derivación, la suite se pone roja en vez de que dos pollers empiecen a correr a la vez en
silencio.

**El lock es de transacción, no de sesión.** Verificado ejecutando contra el Postgres local:

| Comprobación | Resultado |
|---|---|
| Transacción A toma el lock; B lo intenta mientras A vive | `A:true`, `B:false`, sin bloquear a B |
| `pg_locks` mientras A vive | una fila `advisory`, `granted = t` |
| Tras el `COMMIT` de A | `0` advisory locks: se suelta solo |
| C lo intenta después del `COMMIT` de A | `C:true` |
| `pg_try_advisory_xact_lock` **fuera** de una transacción (autocommit) | devuelve `true` y lo suelta en el acto: **no protege nada** |
| Clave negativa (`-8598157114941140293`) por parámetro de Prisma | aceptada; el `bigint` de Postgres es con signo y `readBigInt64BE` encaja exacto |
| Dos `prisma.$transaction` concurrentes con la misma clave | `A:true B:false` |

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `pg_try_advisory_lock` (sesión) + `pg_advisory_unlock` | **Es la trampa de este ADR.** Prisma asigna una conexión del pool **por consulta**: no hay garantía de que el `unlock` viaje por la misma conexión que tomó el lock. El lock se quedaría pegado a una conexión ociosa y el negocio dejaría de sincronizar hasta que esa conexión se reciclara. Y una corrida que muere a mitad no lo suelta nunca. |
| `hashtextextended(namespace \|\| negocioId, 0)` en SQL | Correcta y más corta, pero no hay forma de probarla sin base de datos, y el proyecto no tiene tests con base. Deja la pieza más delicada de la exclusión mutua sin ninguna cobertura automática. |
| `pg_try_advisory_lock(classid int4, objid int4)`, con `classid` fijo | Namespacing más limpio, pero deja solo 32 bits para el negocio: colisión de cumpleaños a ~65 000 negocios. Con 64 bits el mismo razonamiento da ~4 000 millones. |
| Una tabla `SyncLock` con `INSERT` y `UNIQUE`, o un `SELECT … FOR UPDATE` sobre `Negocio` | Funciona, pero deja basura si el proceso muere (hay que inventar un TTL y un barrendero) o bloquea la fila del negocio para todo lo demás. El advisory lock de transacción se limpia solo por definición. |
| Serializar todo el cron con un único lock global | Un negocio lento retrasa a todos los demás. El contrato pide un poller por **negocio**, no uno por plataforma. |
| Exclusión en memoria del proceso | En Vercel cada invocación es un proceso nuevo. No exclusión de ninguna clase. |

## Consecuencias

**A favor:**
- Se suelta solo: al hacer commit, al hacer rollback, y si el proceso se muere y la conexión cae.
  No hay estado que limpiar ni TTL que ajustar.
- `pg_try_*` **no espera**: la segunda corrida sale al instante en vez de encolarse detrás de la
  primera y agotar el `maxDuration` de la función.
- La derivación es una función pura con vectores dorados: F-010 no puede cambiarla por accidente.
- La ranura es verificable hoy, sin que exista el pull: basta con que el callback no se invoque.

**En contra / coste asumido:**
- Sostener el lock exige mantener una transacción abierta mientras corre el pull. En F-002 eso dura
  microsegundos; **F-010 tendrá una transacción abierta durante un `GET` HTTP**, con el mismo coste
  que se discute en el ADR 0010 y el mismo remedio: un timeout explícito.
- La clave es opaca: en `pg_locks` se ve un par de enteros, no un `negocioId`. Para depurar hay que
  recalcular la clave. Se mitiga logando el `negocioId` en las dos ramas de la ranura.
- Colisión de claves teóricamente posible. Si ocurriera, el efecto es que un negocio se salta un
  ciclo de pull de 2 minutos, no una corrupción ni una fuga.

**Impacto en seguridad y escalabilidad:**
- **Aislamiento:** la clave depende del `negocioId` y de nada más. El lock del negocio A no puede
  afectar al pull del B, y ningún dato cruza la frontera por esta vía.
- La exclusión es lo que impide el **pedido duplicado** que el contrato advierte. No es una
  optimización: es corrección.
- Coste de reversión bajo: la derivación y el ámbito viven en un archivo de veinte líneas y no hay
  nada persistido que migrar si hubiera que cambiarlos.
