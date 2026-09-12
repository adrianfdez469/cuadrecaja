# ADR 0114: Reactivar un cliente borrado se hace sin transacción, con lectura previa y un solo reintento del `P2002`

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-033

## Contexto

`Cliente` lleva `@@unique([nombre, negocioId])` y soft delete (`deletedAt`). F-031 dejó escrita la
consecuencia y a quién le tocaba resolverla (`.agents/specs/F-031.md`, § 2.1):

> `@@unique([nombre, negocioId])` cuenta también las filas con `deletedAt` no nulo, así que dar de
> alta un cliente con el nombre de uno borrado devolverá `P2002`. […] Resolverlo —reactivar en vez
> de recrear— es de **F-033**.

El criterio 4 de F-033 lo exige: crear un cliente con el nombre de uno ya borrado lo **reactiva**
(`deletedAt` a `null`) en lugar de fallar.

Y no es una preferencia de UX. El mismo índice es **el eje de idempotencia del alta de clientes sin
conexión de F-034** (dosier § 11, ficha E-043): si el POST falla con 409 en vez de reactivar,
F-034 no tiene sobre qué apoyarse, y la salida obvia —abrir una segunda columna `@unique` global
para idempotencia— es exactamente el error que E-043 documenta.

La restricción técnica que gobierna la forma de la solución es
[E-038](../../.agents/errors/E-038-el-p2002-no-se-recupera-dentro-de-la-transaccion.md): en
PostgreSQL una violación de restricción **aborta la transacción entera**, así que un `try/catch` de
`P2002` **dentro** de un `$transaction` atrapa el error pero no revierte el estado del servidor, y
todo lo que venga después se ignora, incluido el commit.

## Decisión

**El alta de cliente es `lectura → decisión pura → una sola escritura`, y no abre ninguna
`$transaction`. El `P2002` se atrapa donde ocurre —fuera de cualquier transacción— con un único
reintento acotado.**

Tres piezas, y ninguna es redundante:

1. **La lectura previa.** Antes de escribir se busca la fila por
   `withTenantScope("cliente", { nombre }, negocioId)`, **sin filtrar por `deletedAt`**: es el
   camino frecuente y real (alguien vuelve a dar de alta a un cliente que borró la semana pasada) y
   resuelve el caso secuencial sin violar nada.
2. **La decisión, pura.** `decideClienteUpsert` traduce lo leído a `CREATE`, `REACTIVATE` o
   `DUPLICATE`. Es una función sin base de datos, importable desde `src/__tests__/`, y es la única
   definición de esa regla.
3. **El reintento.** Un `P2002` solo puede llegar aquí si otra petición ganó la carrera entre la
   lectura y la escritura. Se reintenta **una vez**: en la segunda pasada la lectura del punto 1 ya
   encuentra la fila y devuelve `REACTIVATE` o `DUPLICATE`. Si se resuelve, se resuelve a la
   primera; si no, no era eso.

**No se abre `$transaction` porque no hace falta:** la operación es *una* escritura
(`create` o `update`), y una escritura suelta de Prisma ya es atómica. Al no haber transacción, el
mecanismo de E-038 —el estado abortado que sobrevive al `catch`— no tiene dónde ocurrir. Esto es un
uso de E-038 por evitación, no por aplicación de su receta de dos mitades.

**Qué observa quien llama.** La respuesta del POST lleva un campo `action` explícito con el valor
`CREATE` o `REACTIVATE`. No se deduce de que `deletedAt` haya pasado a `null` ni de comparar
`createdAt` con `updatedAt`: una señal de estado que nadie escribe y que hay que inferir de una
resta es la forma exacta de
[E-013](../../.agents/errors/E-013-columna-que-nadie-escribe-usada-como-senal-de-estado.md).

**Qué NO hace la reactivación.** No toca ninguna `CuentaPorCobrar`, ni viva ni saldada. Reactivar
es poner `deletedAt` a `null` y escribir los campos del cuerpo de la petición sobre la fila que ya
existía; el `id` se conserva, así que las deudas históricas que ya apuntaban a ese cliente siguen
apuntando al mismo. Conservar el `id` es lo que hace que la reactivación sea el reverso exacto del
borrado en blando decidido en `.agents/specs/F-031.md`, § 2.1.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `try/catch` del `P2002` dentro de un `$transaction` | Es literalmente E-038: en Postgres la violación aborta la transacción y la recuperación no puede vivir dentro de ella |
| `upsert` de Prisma sobre el índice compuesto | Su `update` correría también cuando la fila está **activa**, que es el caso que debe ser 409. Habría que distinguirlo después de escribir, es decir, escribir primero y decidir luego |
| Excluir las filas borradas del índice único (índice parcial) | Prisma no lo expresa en el schema, obligaría a SQL a mano en la migración, y **destruiría el eje de idempotencia que F-034 necesita** (dosier § 11, E-043): dos filas con el mismo nombre podrían coexistir si una está borrada |
| Un segundo `@unique` global como clave de idempotencia del alta offline | Es E-043 tal cual: una columna `@unique` global usada para idempotencia acaba siendo un eje de tenant |
| Reactivar también desde el `PUT` (renombrar un cliente al nombre de uno borrado lo fusiona) | Fusionar dos clientes está declarado fuera de alcance en las `notes` de F-033. El `PUT` responde 409 en ese caso |
| Reintentar el `P2002` en bucle | El único fallo que el reintento puede resolver es «alguien ganó la carrera». Un bucle convierte un fallo permanente en uno indistinguible de un cuelgue |

## Consecuencias

**A favor:**
- El criterio 4 se verifica ejecutando: borrar, volver a crear, leer `action: "REACTIVATE"`.
- F-034 tiene un eje de idempotencia estable para el alta offline, y es el que ya existe.
- No hay ninguna transacción interactiva nueva en la ruta más caliente del CRUD.

**En contra / coste asumido:**
- Hay una ventana entre la lectura y la escritura. Se cierra con el índice único, que es la
  autoridad, más el reintento; no se cierra con un bloqueo.
- La reactivación **sobrescribe** `descripcion`, `direccion` y `telefono` de la fila borrada con lo
  que traiga el cuerpo del POST. Quien reactiva está dando de alta a un cliente, y lo que escribe
  es lo que quiere. Los campos que el cuerpo no traiga se dejan como estaban.
- Dos clientes cuyos nombres solo difieren en mayúsculas o en tildes siguen siendo dos filas: el
  índice es de Postgres y compara el texto tal cual se guardó. `normalizeClienteNombre` recorta y
  colapsa espacios; no pliega ni el caso ni los acentos. La fusión es un feature aparte.

**Impacto en seguridad y escalabilidad:**
- La lectura previa va acotada por `withTenantScope("cliente", …, negocioId)`, así que el nombre de
  un cliente de otro negocio no puede ser reactivado ni detectado desde aquí.
- Coste por alta: una lectura y una escritura en el caso normal; una lectura y una escritura de más
  solo en la carrera.
