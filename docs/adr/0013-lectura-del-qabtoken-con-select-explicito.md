# ADR 0013: El `qabToken` se lee con `select` explícito, nunca con `select` + `omit`

**Estado:** aceptado
**Fecha:** 2026-09-02
**Feature:** F-002
**Refina:** [ADR 0006](0006-qabtoken-invisible-por-defecto.md)

## Contexto

El ADR 0006 hizo `Negocio.qabToken` invisible con un `omit` global en el cliente de Prisma, y dejó
escrita la instrucción para quien necesitara leerlo:

> *"El opt-in explícito es el único punto que hay que auditar. F-003 —que guarda el token— y F-002
> —que lo usa para autenticarse contra QAB— serán las únicas líneas del repositorio con
> `omit: { qabToken: false }`."*

F-002 es el primer consumidor real de esa instrucción. `loadQabTokens` necesita, para un puñado de
`negocioId`, **solo** el id y el token: nada más de la fila. La escritura natural sería combinar el
opt-in con una proyección estrecha:

```ts
prisma.negocio.findMany({
  where: { id: { in: negocioIds } },
  select: { id: true, qabToken: true },
  omit: { qabToken: false },      // ← lo que decía el ADR 0006
});
```

Y eso **no compila en tiempo de ejecución**. Comprobado con la versión fijada en `package.json`,
contra la base de desarrollo, con centinela y control negativo (la lección de E-002: una ausencia
que admite dos explicaciones no es evidencia de ninguna):

| Consulta | Resultado |
|---|---|
| A — `findUnique({ where })`, sin pedir nada | La clave `qabToken` **no está** en el objeto |
| B — `select: { id: true, qabToken: true }` | Devuelve `qabToken: "qab_live_SENTINELA_F002_7b1e"`, y solo esas dos claves |
| C — `omit: { qabToken: false }` | Devuelve el centinela **y las 16 columnas** de la fila |
| D — control: un `PrismaClient` **sin** la defensa | Devuelve el centinela: la ausencia de A es la defensa, no un cliente desactualizado |
| E — `select` **y** `omit` juntos | Error: *«Please either use `omit` or `select`, but not both at the same time.»* |

El hallazgo que importa: **un `select` explícito ya vence al `omit` global** (fila B). El opt-in que
prescribía el ADR 0006 no solo es innecesario cuando hay `select`, es incompatible con él.

## Decisión

**Cuando haga falta el `qabToken`, se pide con un `select` explícito que nombre exactamente los
campos necesarios. Nunca se combina con `omit`.**

```ts
// src/lib/qab/outboxDrain.ts — el ÚNICO sitio de F-002 que lee el token
const rows = await tx.negocio.findMany({
  where: { id: { in: negocioIds } },
  select: { id: true, qabToken: true },
});
```

`omit: { qabToken: false }` queda reservado para el caso —si aparece— en que de verdad haga falta la
fila entera **más** el token. F-002 no tiene ese caso.

Dos consecuencias que forman parte de la decisión:

- **El resultado se tipa solo.** Prisma infiere `{ id: string; qabToken: string | null }` a partir
  del `select`, así que no hace falta el «tipar el resultado aparte» que anticipaban las notas de
  F-001. `NegocioRow` de `src/lib/prisma.ts` sigue siendo el tipo de una fila leída de la forma
  normal, sin token, y no se toca.
- **`where` sobre un campo omitido funciona con normalidad** (verificado):
  `findMany({ where: { qabToken: { not: null } }, select: { id: true } })` filtra por el token sin
  devolverlo. Es como el cron elige los negocios candidatos al pull sin que el secreto salga de la
  base.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `omit: { qabToken: false }` a secas, como decía el ADR 0006 | Funciona (fila C), pero trae **las 16 columnas** de `Negocio` a memoria cuando hacen falta dos, y deja el objeto entero —con el token dentro— circulando por el drenaje, donde es más fácil que acabe en un log o en un informe por descuido. El `select` estrecho es a la vez más barato y más seguro. |
| `$queryRaw` para leer el token | Se salta el `omit`, sí, y también se salta el tipado y cualquier auditoría por `grep`. La protección del ADR 0006 no alcanza al SQL a mano: precisamente por eso no es el camino a recomendar. |
| Un segundo `PrismaClient` sin el `omit` para el módulo de QAB | El ADR 0006 ya lo señala como el modo de perder la defensa: el repositorio tiene un singleton y hay que mantenerlo así. |
| Enmendar el ADR 0006 en vez de escribir este | Los ADR registran lo que se decidió y cuándo. La instrucción del 0006 se escribió con la información que había; lo correcto es refinarla desde un ADR nuevo que la referencie, no reescribir la historia. |

## Consecuencias

**A favor:**
- `implementer` y `dev-tester`, que trabajan sin verse, escriben la misma llamada. Sin este ADR el
  primero habría escrito la forma del ADR 0006 y se habría encontrado un error en tiempo de
  ejecución, y el segundo habría escrito un test contra una firma que no puede existir.
- Menos superficie: solo dos columnas salen de la base, en un solo módulo.
- La auditoría del ADR 0006 sigue siendo un `grep -rn "qabToken" src/`, y ahora tiene que encontrar
  exactamente una aparición nueva, en `loadQabTokens`.

**En contra / coste asumido:**
- Hay ahora **dos** formas válidas de pedir el token —`select` estrecho y `omit: { qabToken: false }`—
  y solo una es la recomendada. Este ADR es lo que evita que la ambigüedad cueste el tiempo de otro.
- El comportamiento («un `select` explícito vence al `omit` global») es de Prisma y podría cambiar
  en una versión mayor. Está verificado contra la versión fijada hoy; un salto de Prisma exige
  volver a comprobarlo.

**Impacto en seguridad y escalabilidad:**
- **El token se lee en un único punto** de todo el repositorio y no aparece en el informe del cron,
  en ninguna respuesta HTTP, en ningún log ni en ningún mensaje de error. `ultimoError` guarda
  fragmentos del **cuerpo de la respuesta** de QAB, nunca de la petición, que es donde viaja.
- **Aislamiento:** `loadQabTokens` devuelve un `Map` indexado por `negocioId` y cada `POST` usa el
  token de la clave de su propio grupo. La estructura es lo que impide enviar el lote de un negocio
  con el token de otro.
- Coste de reversión nulo: es la forma de escribir una consulta, no un dato persistido.
