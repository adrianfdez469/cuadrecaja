# ADR 0084: La cláusula de tenant de estas funciones es un filtro, no una aserción — fuera de tenant se devuelve el resultado vacío

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-022

## Contexto

Al meter `negocioId` en las cinco funciones aparece una pregunta que el spec no responde y que
`implementer` y `dev-tester` **no pueden contestar cada uno por su lado**: qué hace la función
cuando el `tiendaId` que recibe no pertenece al `negocioId` que recibe.

Tres respuestas son defendibles y producen tests incompatibles entre sí: lanzar una excepción,
devolver el resultado vacío, o comprobar la pertenencia con una consulta previa y distinguir «no
existe» de «es de otro». Que cada agente elija la suya es exactamente E-030: el docstring de la
firma y el criterio ejecutable del ADR afirmando cosas incompatibles, con implementación y tests
divergiendo sin que ninguno de los dos se equivocara.

Dos restricciones acotan la respuesta:

- **Tras F-021 el desajuste es inalcanzable desde HTTP.** Las siete entradas llaman antes a
  `assertTiendaTenant`, que devuelve el par `{ negocioId, tiendaId }` ya comprobado contra la
  sesión. Lo que se está decidiendo es el comportamiento de un caso que hoy solo puede producir un
  llamador futuro equivocado — que es justo el motivo del feature.
- **Identidad, permiso y alcance ya tienen dueño, y no es esta capa.** ADR 0077 fija que fuera de
  tenant la ruta responde 404, sin permiso 403, y que el 401 es solo del middleware. `src/lib/` no
  devuelve respuestas HTTP.

## Decisión

**Una sola regla para las cinco funciones: el `negocioId` entra en el `where` y nada más.** No hay
comprobación previa de pertenencia, no hay consulta extra, no hay excepción propia. Si la tienda no
es del negocio, la consulta no encuentra filas y la función devuelve **el resultado vacío que le
corresponde a su tipo**:

| Función | Resultado fuera de tenant |
|---------|---------------------------|
| `fetchDiscountRulesForTienda` | `[]` |
| `applyDiscountsForSale` | Lo que `applyDiscounts` produce con `rules: []` — no se parafrasea aquí (E-039); el motor no se toca |
| `analizarCPPTienda` | `[]` |
| `detectarDesviacionesCPP` | `[]` |
| `migrarDatosHistoricosCPP` | El reporte con `movimientosEncontrados: 0`, `movimientosProcesados: 0` y `errores: 0`, y sin ninguna línea de detalle por movimiento — con `dryRun: true` conserva sus dos líneas de cabecera, que ya hoy se emiten con cero movimientos |

Es decir: **la cláusula de tenant es un filtro, no una aserción**. La consecuencia buscada es que
`fetchDiscountRulesForTienda` con un `tiendaId` inventado devuelva las reglas del `negocioId`
recibido (criterio 2), no un error: el `tiendaId` no participa en esa consulta (ADR 0083).

Esto no dice nada sobre los demás fallos. Un error de base de datos sigue propagándose exactamente
como hoy, y los `try/catch` que ya existen en los llamadores siguen decidiendo qué hacer con él.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Lanzar una excepción cuando la tienda no es del negocio | Cuesta una consulta más en cada venta para detectar un caso que `assertTiendaTenant` ya descartó. Y no produce el error visible que se espera: las dos rutas de venta envuelven `applyDiscountsForSale` en un `try/catch` que **sigue adelante sin descuentos**, así que el throw acabaría vendiendo sin descuento y en silencio — el mismo resultado que devolver vacío, con una consulta y un camino de error de más. |
| Devolver un resultado discriminado (`{ ok, data }` / `null` de «no pertenece») | Obliga a los siete llamadores a distinguir «no hay reglas» de «no pertenece» para acabar haciendo lo mismo en los dos casos. Y `strict` está desactivado: el estrechamiento de uniones por bandera no es fiable en este repositorio (E-036, y el propio comentario de `ITenantScopeResult`). |
| Que la función devuelva una `NextResponse` 404, como hace `tenantScope.ts` | `src/lib/reports/` y `src/lib/discounts/` no son la capa HTTP. Duplicaría la decisión de ADR 0077 en un segundo sitio, con el riesgo de que las dos se desincronicen (E-014). |
| Una regla por función, según lo que le venga mejor a cada una | Es la forma exacta de E-030. El `dev-tester` escribe contra este documento sin ver el código: cinco reglas distintas son cinco oportunidades de que el test falle por un motivo falso. |

## Consecuencias

**A favor:**
- Un solo enunciado que cubre las cinco funciones, escrito antes de que se programe, y que el test
  puede afirmar tal cual.
- Cero consultas nuevas. El coste del feature es un `AND` más en `where`.
- El comportamiento de todas las llamadas legítimas es idéntico al de antes: cuando el par es
  coherente —que es siempre, tras `assertTiendaTenant`— el `where` selecciona exactamente las mismas
  filas.

**En contra / coste asumido:**
- Un llamador futuro que se equivoque de negocio verá «no hay datos» en vez de un error ruidoso. Es
  el precio de no pagar una consulta por venta, y el diagnóstico queda en este documento.
- «Vacío» y «fuera de tenant» son indistinguibles desde fuera. Es la misma indistinguibilidad
  deliberada que ADR 0077 eligió para el 404: la ruta no debe ser un oráculo de la existencia de
  ids ajenos.

**Impacto en seguridad y escalabilidad:**
- Ninguna fila de otro negocio entra en el resultado por ningún camino, incluida la escritura de
  `migrarDatosHistoricosCPP` (ADR 0085).
- Sin consulta de pertenencia, la ruta caliente —el POS calculando descuentos en cada venta— no
  paga nada por el aislamiento.
