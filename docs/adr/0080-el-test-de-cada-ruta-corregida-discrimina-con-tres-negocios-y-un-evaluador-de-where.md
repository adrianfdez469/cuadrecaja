# ADR 0080: El test de cada ruta corregida discrimina con tres negocios y un evaluador de `where`

**Estado:** aceptado
**Fecha:** 2026-09-05
**Feature:** F-021

## Contexto

El criterio 6 pide «un test por cada ruta corregida que **falla si se quita el filtro por
`negocioId`**». El criterio 10 aprieta más: la base de prueba debe contener «al menos dos negocios
con datos homónimos o equivalentes», de modo que el test no pueda pasar por accidente.

Esa formulación viene de E-008, que en F-018 mordió tres veces: con **una sola tienda** en la base,
«ver solo la mía» y «verlas todas» devuelven exactamente lo mismo, y el criterio pasa con el código
roto. La lección literal de esa ficha: *un test solo prueba algo si existe un estado del mundo en el
que habría fallado*.

Y hay una restricción dura que condiciona todo lo demás: **la suite de este repositorio no toca la
base de datos**. Vitest corre en entorno `node`, sin `@testing-library/react`, sin Postgres, y
`src/app/api/` no tiene hoy ninguna cobertura (`AGENTS.md`). Los trece tests que rozan Prisma lo
mockean (`vi.mock("@/lib/prisma", ...)`). Un test que arrancara Postgres sería el primero, y no es lo
que este feature debe introducir.

La tentación fácil es escribir, por cada ruta, un `expect(where).toEqual({ ..., negocioId })`. Eso
falla si se quita el filtro, sí — pero es **la misma frase escrita dos veces**, una en el código y
otra en el test. Comprueba que alguien tecleó lo mismo dos veces, no que el aislamiento aísle.

## Decisión

El test de cada ruta corregida tiene **dos mitades dentro del mismo `it()`**, y la segunda es la que
lo hace discriminar.

**Mitad 1 — la forma.** Se afirma, con igualdad profunda, el objeto `where` que produce la pieza pura
del ADR 0076 para esa ruta: `tiendaTenantWhere` o `withTenantScope(modelo, where, negocioId)`. Falla
si el filtro desaparece.

**Mitad 2 — el fixture de tres negocios y el evaluador.** Existe un fixture con **tres** negocios, y
cada uno cubre un modo de fallo distinto:

- **`N_A`** — el tenant de la sesión. Es la fila que debe volver.
- **`N_B`** — el **homónimo**: `T_B` se llama igual que `T_A` y su destino se llama igual que el de
  `T_A`; solo cambia el `negocioId`. Es lo que exige el criterio 10 y lo que impide el falso aprobado
  de E-008.
- **`N_C`** — el **control**, y cubre el fallo contrario (**E-032**): una guarda implementada **más
  ancha** de lo que dice el contrato —que aceptara cualquier tienda con el mismo *nombre* en vez del
  mismo `negocioId`— **pasaría todos los casos de A y B** y seguiría escapándose, porque quien la
  escribe solo prueba la rama que el contrato describe. `N_C` no comparte ningún nombre con `N_A`: su
  trabajo es **no aparecer nunca**, en ninguna de las ramas.

Y un evaluador `matchesWhere(fila, where)` escrito en el test, que interpreta el `where` sobre esas
filas —incluidas las cláusulas anidadas `tienda: { negocioId }` y
`cierrePeriodo: { tienda: { negocioId } }`—. Sobre él se afirman **tres cosas**:

- con el `where` real y la sesión del negocio A → **exactamente una fila**, y es la de A;
- con **ese mismo `where` al que se le ha quitado la cláusula de tenant** → **dos filas**;
- en ninguna de las dos ramas aparece `N_C`.

Las dos últimas son el ADR entero. La segunda deja constancia de que el fixture **distingue** las
ramas: con un solo negocio, las dos devolverían una fila y el `it()` fallaría al escribirse. La
tercera es lo único que detecta una guarda demasiado ancha, que es el modo de fallo que **pasa todas
sus propias pruebas** (E-032).

**Un caso por ruta, y salen del inventario.** Los casos no se escriben a mano uno a uno: se recorren
con `it.each` sobre las entradas del inventario del ADR 0079 marcadas como corregidas por F-021, cada
una con su `tenantModel` y su parámetro. Así hay literalmente un caso por ruta corregida —criterio
6— y el mismo test cubre el criterio 9.

**La guarda contra el `it.each` vacío.** Antes del `it.each`, el archivo afirma que la lista tiene
**al menos 39 entradas** —el número que arroja el triaje de este feature. Un `it.each` sobre un
array vacío produce **cero tests y una suite verde**: E-008 en su forma más pura. La afirmación
previa lo convierte en un fallo ruidoso.

**Lo que este test NO promete, dicho aquí para que nadie lo suponga.** No importa ningún `route.ts`,
no levanta un servidor y no toca Postgres. Verifica **la pieza de aislamiento y su cableado
declarado en el inventario**, no que el handler la llame. Que la llame lo comprueba el `qa`
**ejecutando** el `curl` de los criterios 2, 3 y 9 contra dos negocios reales. Las dos mitades son
necesarias y ninguna sustituye a la otra.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Un Postgres de pruebas (testcontainers, base efímera) | Sería la primera dependencia de base de datos de la suite, que hoy corre entera en menos de un segundo y sin servicios. Cambia el coste de ejecutar tests para todo el equipo, y no hay CI que lo amortice |
| Mockear `prisma` con `vi.fn()` y afirmar los argumentos de la llamada | Afirma que se llamó con cierto objeto: la misma frase escrita dos veces. No hay ninguna fila del negocio B que pudiera colarse, así que no existe el estado del mundo en el que fallaría — E-008 exacto |
| Solo la mitad 1 (igualdad profunda del `where`) | Igual: no discrimina. Es el test que pasaría con un fixture de un solo negocio |
| Tests de integración HTTP con `next-test-api-route-handler` | Arrastra Next y la base al entorno de test; y sin base de datos el handler no llega a consultar nada |
| Dejar los criterios 6 y 10 enteramente al `qa` con `curl` | El `curl` se ejecuta una vez y no protege de la regresión de mañana. Un test se ejecuta siempre |
| Escribir los 39 casos a mano | Se desincronizan del inventario en el primer cambio, y nada avisa. Derivarlos del JSON ata las dos cosas |

## Consecuencias

**A favor:**
- Existe, para cada ruta corregida, un estado del mundo en el que el test habría fallado —el negocio
  B con su fila homónima—, que es la definición de E-008 de «verificado» frente a «ejecutado».
- La suite sigue sin base de datos y sigue tardando menos de un segundo.
- Añadir una ruta corregida es añadir una entrada al inventario: el caso de test aparece solo.
- Quitar la cláusula de tenant de `TENANT_RELATION_PATH` rompe las dos mitades a la vez.

**En contra / coste asumido:**
- El evaluador `matchesWhere` es un doble parcial de Prisma: entiende igualdad y relaciones
  anidadas, y nada más. Si una ruta corregida necesitara un `where` con `OR`, `in` o `not`, hay que
  ampliarlo. Se acepta: las 39 rutas de este feature usan igualdad y anidamiento.
- Un doble puede divergir de Prisma. El riesgo se acota a lo que el doble evalúa —una comparación de
  igualdad— y lo cubre el `curl` del `qa`, que sí pasa por Prisma de verdad.
- El fixture hay que mantenerlo con tres negocios. Es precisamente lo que se quiere que cueste
  mantener.

**Impacto en seguridad y escalabilidad:**
- La regresión que este feature cierra queda cubierta por un test que **falla** cuando reaparece,
  no por una convención.
- Coste nulo en producción: el evaluador vive solo en `src/__tests__/`.
