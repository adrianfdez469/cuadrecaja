# ADR 0003: `Decimal(14,2)` para los importes nuevos; `ProductoTienda.precio` se queda en `Float`

**Estado:** aceptado
**Fecha:** 2026-09-01
**Feature:** F-001

## Contexto

En este feature conviven dos poblaciones de dinero con historias distintas.

**La que ya existe.** `ProductoTienda.precio` es `Float` en Prisma (`double precision` en Postgres),
igual que `costo` y que el resto del dinero del repositorio. El SQL espejo de reconciliación del
contrato hace `round(pt."precio"::numeric, 2)` sobre esa columna, y el criterio 4 exige que las
cuatro filas del vector de prueba den `hash = 62e399684e3a8eafadaae58391537955`. La tentación es
«aprovechar y pasarlo a `Decimal`».

**La que nace ahora.** Los importes de `PedidoEntrante` y `PedidoEntranteLinea`. Desde la v6 del
contrato **todos los importes del pull viajan como cadena con dos decimales**, cero incluido
(`"880.00"`, `"0.00"`), y hasta la v5.1 salían sin los ceros de relleno (`"880"`, `"180.5"`, `"0"`).
Los dos formatos van a convivir en la práctica, porque el lado receptor todavía no ha desplegado la
v6. F-010 exige en su criterio 4 que `"880"` y `"880.00"` **produzcan el mismo valor guardado**.

Restricción de fondo del contrato: `price` viaja con **dos decimales como máximo**, y con más los
dos lados redondean distinto de forma permanente — `2.675` se serializa `"2.67"` en JavaScript y
`round(2.675, 2)` en Postgres da `2.68`. Ese producto no converge nunca.

Dato medido, no supuesto: el vector de prueba se ejecutó contra las dos formas de la columna, con el
SQL espejo literal.

| Tipo de `precio` | `products` | `hash` |
|---|---|---|
| `double precision` | 4 | `62e399684e3a8eafadaae58391537955` |
| `numeric(12,2)` | 4 | `62e399684e3a8eafadaae58391537955` |

## Decisión

**Dos respuestas distintas, porque son dos problemas distintos.**

1. **`ProductoTienda.precio` no se toca: sigue siendo `Float`.** Reproduce el hash publicado, y
   cambiarlo sería un `ALTER TABLE … TYPE` sobre la tabla más caliente del sistema —una reescritura
   completa, justo lo que el criterio 1 prohíbe—. `umbralBajo` se crea como `Float?` por la misma
   familia: siendo del mismo tipo que `existencia`, Postgres no mete un cast en el `indexdef` y el
   literal `existencia <= "umbralBajo"` que exige el criterio 8 aparece tal cual.
2. **Los importes nuevos son `Decimal @db.Decimal(14, 2)`** (`numeric(14,2)`), y las cantidades
   `Decimal @db.Decimal(14, 3)`. Con escala fija, `"880"` y `"880.00"` **son el mismo valor
   almacenado**, literalmente, que es lo que pide F-010.
3. **El borde de entrada se normaliza antes de persistir**, con `qabAmountSchema` /
   `qabQuantitySchema` en `src/schemas/qabAmount.ts`: la salida es siempre una cadena de escala
   fija, y se rechaza todo lo que traiga más decimales de la cuenta —incluido el número `2.675`,
   que es el caso de divergencia que el contrato documenta—. Prisma acepta esa cadena directamente
   para una columna `Decimal`.

Y una regla que sobrevive a cualquier versión del contrato: **los importes se comparan como números,
nunca como cadenas.**

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Migrar `ProductoTienda.precio` a `Decimal` «ya que estamos» | `ALTER TABLE … TYPE` reescribe la tabla más caliente del sistema. Viola el criterio 1, y el hash del contrato ya se reproduce con `Float`: se pagaría el riesgo sin comprar nada. |
| `Float` también para los importes nuevos, por coherencia con el repo | Coherencia con la parte del repo que menos nos gusta. Son importes que se comparan contra los de otra organización y que alimentan una guarda de despacho: la exactitud vale más que la uniformidad. |
| Guardar los importes como `String`, tal cual llegan | Falla el criterio 4 de F-010 de la forma más directa: `"880" !== "880.00"`. Y obliga a parsear en cada comparación, que es la puerta de entrada a comparar dinero como texto. |
| `Int` de centavos | Exacto, pero introduce una tercera convención de dinero en un repositorio que ya tiene una, y obliga a multiplicar y dividir en cada frontera. `numeric` da la misma exactitud sin ese impuesto. |
| Escala 4 o 6, «por si acaso» | El contrato fija dos decimales como precondición de la convergencia del hash. Una escala mayor guardaría en silencio valores que nunca convergerán en el otro lado. |
| No normalizar y dejar que Prisma redondee al insertar | El redondeo silencioso a escala 2 aceptaría `2.675` y lo guardaría como `2.68`, mientras el otro lado dice `2.67`. La divergencia sería permanente y sin síntoma. Mejor rechazarlo ruidosamente en el borde. |

## Consecuencias

**A favor:**
- `"880"` y `"880.00"` son el mismo valor guardado, sin depender de la versión del contrato con la
  que se emitió el pedido.
- Los importes de pedidos son exactos: se suman y se comparan sin acumular error binario.
- El caso de redondeo divergente del contrato falla **ruidosamente en el borde**, en vez de
  guardarse mal y aparecer semanas después como una reconciliación que no converge.
- El criterio 4 queda verificado contra el tipo real de la columna, no contra uno hipotético.

**En contra / coste asumido:**
- Es la **primera** aparición de `Prisma.Decimal` en este repositorio: quien lea una fila de
  `PedidoEntrante` recibe objetos `Decimal`, no `number`, y mezclarlos con la aritmética de
  `src/lib/` (que trabaja en `number`) requiere una conversión explícita. F-010 y F-013 lo heredan.
- Conviven dos representaciones de dinero: `Float` en el catálogo y el POS, `Decimal` en los
  pedidos entrantes. Está justificado, pero hay que saberlo antes de mover un importe de un lado al
  otro.
- `Decimal` serializa a JSON como cadena. Toda respuesta que exponga estos importes tiene que
  decidir su formato explícitamente en vez de confiar en el `JSON.stringify` por defecto.

**Impacto en seguridad y escalabilidad:**
- Ninguna implicación de aislamiento entre tenants.
- Escalabilidad: `numeric` es algo más lento que `double precision` en agregaciones masivas. Sobre
  pedidos entrantes —donde se agregan decenas de líneas, no millones— es irrelevante; y la parte
  caliente del sistema, `ProductoTienda`, se queda exactamente como estaba.
- Riesgo de negocio acotado: el modo de falla que este ADR evita es cobrar de menos o de más por
  una diferencia de céntimos que ninguna de las dos partes puede reproducir.
