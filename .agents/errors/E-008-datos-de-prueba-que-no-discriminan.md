# E-008: Datos de prueba que no discriminan, y el falso aprobado que producen

**Área:** tests
**Apariciones:** 4 — F-018 (tres veces dentro del mismo feature) · F-029 · F-032 · F-033

## Síntoma

No hay mensaje de error: **el criterio pasa**. Ese es el problema. La verificación devuelve el
resultado esperado, pero lo habría devuelto igual con el código roto, porque los datos de la base
local no distinguen las dos ramas que se quieren comparar.

Tres veces en un solo feature:

```
1. Criterio de aislamiento por tienda: con UNA sola tienda en la base, "ver solo mi tienda" y
   "verlas todas" devuelven exactamente lo mismo.
2. Criterio del lote del outbox: sin suficientes filas pendientes, "toma como máximo 500" y
   "toma todo" son indistinguibles.
3. GET de administración de planes: sin ningún plan inactivo, listPlans() (sin filtro) y
   listActivePlans() (with activo:true) devuelven el mismo conjunto.
```

## Causa raíz

La base de datos de desarrollo tiene los datos que hacen falta para **usar** la aplicación, no los
que hacen falta para **falsarla**. Una verificación solo prueba algo si existe un estado del mundo
en el que habría fallado; si las dos ramas del `if` producen la misma salida con los datos
presentes, la comprobación es decorativa por mucho que se ejecute de verdad.

Es el pariente de [E-002](E-002-servidor-dev-con-cliente-prisma-viejo.md): allí el falso aprobado
venía de verificar contra código viejo, aquí de verificarlo contra datos ciegos. Los dos producen
un ✅ que no significa nada.

## Solución

**Sembrar el dato que hace divergir las ramas antes de verificar, y borrarlo después.** En los tres
casos: crear una segunda tienda, sembrar 600 eventos, crear un plan con `activo: false`. Con eso,
las dos ramas devuelven cosas distintas y la comprobación pasa a tener contenido.

## Cómo evitarlo

Antes de dar por verificado un criterio, hacerse la pregunta: **¿con qué datos habría fallado esto?**
Si la respuesta es "no se me ocurre ninguno", no está verificado — está ejecutado, que no es lo
mismo.

Regla operativa para `qa`: cuando un criterio compara dos comportamientos (con permiso / sin
permiso, filtrado / sin filtrar, un tenant / otro), **comprobar primero que los datos locales
distinguen los dos casos**, y sembrarlos si no. Y acompañar siempre el caso positivo de su control
negativo: "no hay filas" también es compatible con "nunca escribe nada".

---

## Adenda F-021 — el fixture sin base de datos, y el tercer negocio

Dos aprendizajes de escribir el test de aislamiento entre tenants **sin una base de datos delante**.

**1. Con un evaluador propio, los dos negocios deben compartir el valor literal.**
La intuición al escribir «con la cláusula → 1 fila, sin la cláusula → 2» es que hacen falta ids
colisionando entre negocios, lo cual es **imposible** con claves primarias únicas. La resolución es
que el evaluador (`matchesWhere`) **no es Prisma**: es propio. Así que el fixture puede —y **debe**—
dar a los dos negocios **el mismo valor literal** en el campo escalar no-tenant. Es la única forma
de que las dos ramas del test diverjan de verdad.

**2. Dos negocios no bastan: hace falta un tercero de control.**
`N_A` es el tenant y `N_B` el homónimo, que es lo que exige esta ficha. Pero una guarda **más ancha
de lo debido** —que filtrara por *nombre* en vez de por `negocioId`— pasaría todos los casos de A y
de B, porque comparten nombre por diseño. Por eso se añade **`N_C`**, que no comparte ningún nombre
y **cuyo trabajo es no aparecer nunca**: es el único que delata esa guarda.

Cada `it()` afirma entonces **tres** cosas, no dos. La primera prueba que la cláusula funciona; la
segunda, que hace falta; la tercera, que no es más ancha de lo debido — que es
[E-032](E-032-una-guarda-mas-ancha-que-la-del-contrato.md).

---

## Adenda F-029 — el autor sospecha del test, y solo la mutación mide cuánto

El `dev-tester` de F-029 entregó su suite **declarando él mismo** que sus tests de orden de
evaluación de `checkCreditInvariant` podían no discriminar: los había construido para no depender
del valor de `delta`, así que una implementación que evaluara la aritmética antes que las reglas
duras los pasaría igual. Una confesión honesta, y el tipo de aviso que esta ficha existe para que
alguien recoja.

Lo que aportó F-029 es **cómo se resuelve una sospecha así**: `qa` no la creyó ni la descartó, la
midió. Aplicó cuatro mutaciones al código real y contó cuáles detectaba la suite:

| Mutación | ¿La suite la detecta? |
|---|---|
| Reordenar el bloque entero (aritmética antes que las tres reglas duras) | Sí — 1 de 23 cae |
| Intercambiar dos reglas duras entre sí | Sí — 1 de 23 cae |
| Mover **solo** la regla 4 delante de las reglas duras | **No — 23 de 23 pasan** |
| Leer `tolerance` con `Number(t) \|\| DEFAULT` en vez de respetar un `0` explícito | **No — 23 de 23 pasan** |

Tres lecciones:

1. **La autoevaluación de quien escribió el test es una hipótesis, no un dato.** Aquí era pesimista
   en una mitad y exacta en la otra. Sin medir, se habría rechazado cobertura buena o firmado un
   hueco real; con medir, se supo exactamente cuál era cuál.
2. **La mutación es el único instrumento que responde «¿con qué datos habría fallado esto?»** —la
   pregunta que abre esta ficha— sin depender de la imaginación de nadie. El protocolo completo es:
   romper, comprobar que cae, **revertir**, y confirmar que vuelve a verde.
3. **Un parámetro con valor por defecto es un discriminador que casi nadie prueba.** `tolerance: 0`
   explícito y `tolerance` ausente son casos distintos, y la lectura naïve `Number(x) || DEFAULT`
   los confunde en silencio: convierte un cero deliberado en el default. Si un contrato dice
   «defaults to X», hay un test que pasar el valor falsy explícitamente.


---

## Adenda F-032 — la siembra que no rompe su criterio, rompe los otros cuatro

Las adendas anteriores son sobre datos que **no distinguen** lo que se cree. Esta es su reverso: un
dato de siembra **correcto para su propio criterio** que invalida en silencio a los demás.

El criterio 6 del diseño de F-032 necesita un carrito con importe 0 para comprobar que la fila «A
crédito» se deshabilita. La instrucción original decía «un producto de precio 0» — vía **cerrada**:
`catalogo_pos/route.ts` filtra `precio: { gt: 0 }` y ese producto no llega nunca al carrito. Se
corrigió a un descuento del 100 %.

Y ahí apareció lo de verdad peligroso. `engine.ts` **solo exige tecleado el descuento cuyo
`conditions.code` existe**, así que una `DiscountRule` del 100 % **sin código**:

- cumple perfectamente el criterio 6,
- y **se autoaplica a todos los carritos de ese negocio**, dejando en 0 el total de los criterios
  1, 3, 4 y 5 —que necesitan exactamente 1.000— sin un solo mensaje de error.

El fallo no se manifiesta donde se sembró. Se manifiesta cuatro criterios más allá, como una cifra
que no cuadra, y el instinto manda a buscar el bug en el código del feature.

**Regla:** antes de sembrar un dato **global al tenant** —una regla de descuento, un impuesto, una
configuración de negocio, un permiso de rol—, pregúntate a qué **otros** criterios afecta. Un
fixture acotado a una fila no necesita esa pregunta; uno que cambia el comportamiento por defecto
del negocio, sí. Y si el dato tiene forma de «se aplica cuando…», comprueba **cuál es la condición
real en el motor**, no la que parece.


---

## Adenda F-033 — el tamaño del fixture también discrimina, y `sort` lo demuestra

Todas las apariciones anteriores son sobre el **contenido** del dato de prueba: dos tenants que
comparten el valor literal, un `tolerance: 0` que se lee como el default, una siembra global que
rompe otros criterios. F-033 añade un eje que no estaba: **cuántos elementos tiene el fixture.**

`buildMovimientoRows` ordenaba con `b.fecha.getTime()` sobre un campo que llegaba como string. El
detalle de cualquier deudor con **dos o más movimientos** respondía 500 — el caso más ordinario del
feature. Sobrevivió a los tests unitarios, a una ronda entera de QA y a dos verificaciones más por
una sola razón:

> **`Array.prototype.sort` no invoca el comparador con 0 o 1 elementos.**

Toda cuenta de un solo movimiento —con lo que se sembró la primera pasada de QA, y con lo que
estaban escritos los tests— **nunca ejecutaba la línea que rompe**. Nadie eligió mal el dato: se
eligió el más simple que ejercitaba la función, y resultó ser el único que no la ejercitaba.

**Regla:** al elegir un fixture, pregúntate no solo *qué valores* lleva, sino **cuántos elementos
tiene y qué caminos del código requieren más de uno**. Un array de uno no ejercita ningún
comparador de `sort`, ningún `reduce` sin valor inicial, ninguna deduplicación, ninguna
comparación entre pares y ninguna paginación. Si la función ordena, agrupa o compara, **el fixture
mínimo son dos**, y el mínimo útil suele ser tres.

Y su reverso, también de F-033: un criterio verificado **por API** con `curl` puede ser correcto y
aun así no ver un fallo que solo existe **a través de la pantalla**. El bug del diálogo que se
tragaba un 400 en silencio ([E-071]) sobrevivió a tres rondas por eso: los criterios de la carrera
concurrente estaban verificados con peticiones directas, correctamente, y ninguno podía verlo.
