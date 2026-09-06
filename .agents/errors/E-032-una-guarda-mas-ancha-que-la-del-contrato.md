# E-032: Una guarda implementada más ancha que la del contrato pasa todas sus propias pruebas

**Área:** api
**Apariciones:** 1 — F-010

## Síntoma

Un negocio terminaba el pull con `outcome: "error"` y sin escribir nada, en un caso completamente
normal: cuando la página **reentregaba pedidos que ya teníamos**. Los criterios 3 y 4 (no duplicar,
y que la corrida siguiente no repita) quedaban rotos, sin ningún mensaje de error.

## Causa raíz

El contrato definía la guarda de «página sin progreso» como **«ningún id legible Y `nextCursor`
nulo»**. Se implementó como **«página no vacía que deja el cursor igual»**, que es más ancha: una
página cuyos pedidos ya están todos en la base deja el cursor igual sin que ninguno de sus ids sea
ilegible, y caía dentro de la guarda.

Un paréntesis del contrato, leído como un ejemplo aclaratorio, era en realidad **la definición
operativa de la condición**.

Lo que hace que se escape: la implementación **pasa todas sus propias pruebas**. Quien la escribe
verifica la rama que el contrato describe —ningún id legible, `nextCursor` nulo— y funciona
perfectamente. La rama que no se prueba es la que la ampliación introdujo sin querer, y esa no está
en el contrato, así que no hay nada que recuerde probarla. No es un caso borde: es el caso frecuente.

## Solución

Estrechar la guarda a la condición literal del contrato. Lo detectó un test del `dev-tester`
(`criterion 3/4: running the pull twice…`), escrito **contra el contrato y sin ver la
implementación** — y, significativamente, lo detectó al hacer el test **más fiel** al escenario real
(dos llamadas desde el mismo cursor, la anomalía de pollers solapados que describe el contrato de
QAB), no al hacerlo más rebuscado.

## Cómo evitarlo

Cuando una guarda del contrato tiene **dos condiciones unidas por Y**, implementarla con las dos.
Sustituirlas por una condición equivalente «en los casos que se me ocurren» es exactamente donde
entra la ampliación: una condición más ancha es un superconjunto, y el conjunto que sobra es
invisible desde el propio código.

Y la razón por la que el pipeline separa quién escribe el código de quién escribe los tests: un
implementador prueba lo que **cree haber escrito**. Solo un test escrito contra el contrato, por
alguien que no ha visto el código, ejercita la rama que la ampliación creó sin que nadie lo decidiera.
