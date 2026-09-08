# E-056: Forzar un error de runtime con un timeout corto es una carrera, y la ausencia que mide es falsa

**Área:** tests
**Apariciones:** 1 — F-028 (parte A)

## Síntoma

Verificando el criterio 11 de F-028 —«el mensaje de una excepción de runtime que termine logueada
no cita el payload ni el token»— hacía falta **provocar una excepción real** dentro de
`cancelSupersededExchangeRateEvents`. El primer intento fue poner un `statement_timeout` muy corto
(1 ms) directamente sobre la consulta bajo prueba:

```
SET LOCAL statement_timeout = '1ms';
-- ...y a continuación la consulta que se quería hacer fallar
```

La consulta **terminó bien**. Sin error, sin excepción, y por tanto sin ningún mensaje que
inspeccionar. Leído en el informe, eso se parece exactamente a «no hay fuga»: el criterio de
ausencia se cumple porque **no hubo nada que medir**.

## Causa raíz

Sobre una base local, sin contención, sin datos y con el plan en caché, la consulta acaba en menos
de un milisegundo. El `statement_timeout` no es una orden de fallar: es un tope que **solo se
dispara si la consulta tarda más**. Forzar el error así no es una condición, es una **carrera
contra el reloj**, y en el entorno donde se verifica —el más rápido posible— se pierde casi siempre.

Y el modo de fallo es el peor posible para un criterio de ausencia: el instrumento no avisa de que
no midió nada. «Ninguna cadena marcadora apareció en el mensaje de la excepción» es literalmente
cierto cuando **no hubo excepción**. Es primo de [[E-008]] —datos que no discriminan— con el
tiempo como variable en vez del dato, y de la exigencia de control positivo que ya llevaba escrita
el contrato de F-028.

## Solución

Abortar la transacción con una sentencia **previa**, y dejar que la consulta bajo prueba falle por
encontrarse dentro de una transacción ya abortada:

```sql
SET LOCAL statement_timeout = '5ms';
SELECT pg_sleep(0.2);   -- esta SÍ excede el tope, con dos órdenes de magnitud de margen
```

A partir de ahí, cualquier sentencia en esa transacción falla con el código `25P02` de Postgres
(«current transaction is aborted»). El fallo ya no depende de una carrera: la transacción está
abortada como **estado**, no como coincidencia. Con eso, la llamada a
`cancelSupersededExchangeRateEvents` lanzó de verdad, el stack apuntó a su propia línea, y el
mensaje pudo inspeccionarse para comprobar que no citaba nada prohibido.

## Cómo evitarlo

Para forzar un error de runtime en una verificación, **elige un mecanismo que sea un estado y no un
plazo**: una transacción abortada, un tipo incompatible, una restricción violada, un cliente cuyo
método rechaza. Un timeout, un `sleep`, un reintento o cualquier cosa que dependa de «que tarde más
que» es una carrera, y en el entorno de verificación se pierde.

Y la regla general, que aplica a **todo criterio de ausencia**: antes de afirmar que algo no
apareció, demuestra en el mismo recorrido que tu instrumento **habría visto la presencia**. Sin ese
control positivo, un arnés que no mide nada se lee igual que un feature correcto. Ver [[E-008]].
