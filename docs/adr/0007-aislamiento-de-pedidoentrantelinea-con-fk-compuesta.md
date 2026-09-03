# ADR 0007: `PedidoEntranteLinea` lleva `negocioId` y cuelga de su pedido con una clave foránea compuesta

**Estado:** aceptado
**Fecha:** 2026-09-01
**Feature:** F-001

## Contexto

El aislamiento entre negocios es la propiedad más crítica de este sistema: `AGENTS.md` la describe
como «el fallo más grave posible». Toda consulta filtra por `negocioId`.

`PedidoEntranteLinea` es la primera tabla de la integración que **no tiene un dueño evidente**. Un
pedido pertenece a un negocio de forma directa; una línea pertenece a un pedido, y solo a través de
él a un negocio. El modelado normal —solo `pedidoId`— obliga a que **cada** lectura de líneas
recuerde hacer el `join` y filtrar por el negocio del pedido. Basta una consulta que se salte el
join para leer líneas de otro tenant, y esas consultas se escriben en features que todavía no
existen (F-010, F-013, F-019, los reportes).

El criterio 10 de F-001 pide que las tres tablas nuevas permitan filtrar por negocio, y de
`PedidoEntranteLinea` dice «al menos por su pedido» — es decir, admite explícitamente la opción
mínima.

Hay una tensión real. Denormalizar `negocioId` en la línea es rápido de consultar pero introduce un
dato que puede **desalinearse** del pedido: dos filas afirmando cosas distintas sobre a quién
pertenece la misma línea. Una denormalización que puede mentir es peor que un `join`.

## Decisión

**`PedidoEntranteLinea` lleva `negocioId`, y ese `negocioId` no es una columna suelta: es la mitad
de una clave foránea compuesta hacia el pedido.**

```prisma
model PedidoEntrante {
  id        String @id @default(uuid())
  negocioId String
  // …
  @@unique([negocioId, qabOrderId])   // idempotencia
  @@unique([id, negocioId])           // destino de la FK compuesta
}

model PedidoEntranteLinea {
  pedido    PedidoEntrante @relation(fields: [pedidoId, negocioId], references: [id, negocioId], onDelete: Cascade)
  pedidoId  String
  negocioId String
  // …
  @@index([pedidoId])
  @@index([negocioId])
}
```

El `negocioId` de la línea **no es una FK a `Negocio`**: es una de las dos columnas con las que
apunta a su pedido. Eso significa que una línea cuyo `negocioId` no coincida con el del pedido
**no puede existir**: Postgres rechaza la fila. La invariante deja de ser algo que hay que recordar
y pasa a ser algo que la base no sabe representar.

A cambio, toda lectura de líneas puede filtrar `where: { negocioId }` directamente, sin `join` y sin
depender de que quien la escriba conozca esta historia.

Regla de código que acompaña la decisión: en un `create` anidado desde el pedido, Prisma rellena los
dos escalares de la relación. Si hiciera falta pasarlos a mano, **se pasa el `negocioId` del pedido,
nunca otro** — y si se pasara otro, la base lo rechaza, que es justamente el punto.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Solo `pedidoId`, y filtrar siempre con un `join` al pedido (el mínimo que el criterio 10 admite) | Correcto **si nadie se olvida nunca**. La seguridad multi-tenant no debería descansar en que cada consulta futura recuerde una regla; y las consultas futuras las escribirán otros features, con otro contexto. |
| `negocioId` denormalizado como columna suelta, sin FK compuesta | Compra la comodidad de la consulta y paga con un dato que puede mentir. Una línea con el negocio equivocado se leería como legítima en un filtro por `negocioId`: convierte un descuido en una fuga silenciosa, que es peor que el problema original. |
| `negocioId` denormalizado más un trigger que valide la coherencia | Misma garantía que la FK compuesta, pero con lógica en la base que nadie más en este repositorio usa, invisible en `schema.prisma` y no expresable en Prisma. |
| Row Level Security de Postgres | Es la defensa más fuerte, pero exige propagar la identidad del tenant a la conexión, y el repositorio usa un singleton de Prisma compartido en un entorno serverless con conexiones agrupadas. Es un cambio transversal, no una decisión de F-001. |
| No guardar las líneas y releerlas de QAB al necesitarlas | No hay endpoint para releer un pedido concreto: es la solicitud **S-001**, abierta. |

## Consecuencias

**A favor:**
- Una línea de un negocio colgando del pedido de otro es **irrepresentable**, no improbable.
- Las consultas de líneas filtran por `negocioId` con la misma forma que el resto del repositorio,
  sin `join` y sin conocimiento especial.
- El borrado en cascada del pedido sigue funcionando igual.

**En contra / coste asumido:**
- Un `@@unique([id, negocioId])` redundante sobre `PedidoEntrante` —`id` ya es clave primaria— que
  existe solo para ser el destino de la FK. Cuesta un índice sobre una tabla que nace vacía.
- Una columna denormalizada más por línea.
- Las relaciones compuestas de Prisma son menos habituales: quien escriba un `create` anidado o un
  `connect` se encontrará con que hay que dar los dos escalares. Está escrito en el contrato de
  interfaces para que no sorprenda.

**Impacto en seguridad y escalabilidad:**
- Es una decisión de seguridad antes que de rendimiento: elimina toda una clase de fuga entre
  tenants en la tabla que más iba a crecer y que más features van a consultar.
- Escalabilidad: evita un `join` en las lecturas de líneas, que en pedidos históricos y reportes por
  rango se acumulan. El índice `[negocioId]` hace que el filtro por tenant sea directo.
- Nada de esto sustituye a la validación de permisos en el backend: es la última red, no la primera.
