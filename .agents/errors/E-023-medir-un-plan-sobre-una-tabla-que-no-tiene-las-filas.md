# E-023: Medir un plan de consulta sobre una tabla que no tiene las filas del plan

**Área:** prisma
**Apariciones:** 2 — F-019 (las dos veces dentro del mismo feature, en agentes distintos y con
signos opuestos)

## Síntoma

No hay ningún mensaje de error: `EXPLAIN` responde con un plan perfectamente válido. El problema es
que es el plan de **otra** situación, y la conclusión que se saca de él es falsa en las dos
direcciones posibles.

**Falsa alarma (el `implementer`).** Con `OutboxEvento` casi vacía, Postgres elige lo correcto para
una tabla diminuta y el índice nuevo no aparece en el plan:

```
Seq Scan on "OutboxEvento"  (cost=0.00..3.20 ...)
```

Al forzar `SET enable_seqscan = off` para «ver si el índice sirve», aparece un `Sort` por encima del
bitmap. De ahí salió un riesgo reportado —«el §5 punto 3 y el ADR 0041 exigen un `Index Scan`
ordenado SIN `Sort`, y podría no cumplirse»— que con datos reales **no existe**.

**Falso aprobado a punto de ocurrir (el `qa`).** El script sembraba 5000 filas, ejecutaba la purga
de verdad y **después** medía el plan. Pero la purga había borrado justo las filas medidas, así que
el `EXPLAIN` volvió a correr contra una tabla vacía: exactamente la medición que el encargo existía
para evitar.

## Causa raíz

Un plan de consulta no es una propiedad de la consulta: es una decisión del planificador sobre **el
estado y las estadísticas de la tabla en ese instante**. Medirlo requiere que las filas del caso
estén presentes *en el momento del `EXPLAIN`*, y las dos formas de que no lo estén son sutiles:

1. **Nunca estuvieron.** La base de desarrollo tiene los datos para *usar* la aplicación, no para
   *falsarla* — el mismo fondo que [[E-008]]. Con una tabla diminuta el `Seq Scan` es la elección
   correcta y no dice nada sobre el comportamiento con volumen.
2. **Estuvieron y se las comió la propia operación bajo prueba.** Medir el plan y ejecutar la
   operación que consume las filas medidas **no pueden compartir la misma siembra** dentro del mismo
   script. Un `DELETE` es destructivo por definición: la segunda mitad del script mide un mundo que
   la primera mitad destruyó.

Y `SET enable_seqscan = off` **no es un sustituto de sembrar volumen**. Solo prueba que la consulta
*es indexable*; el `Sort` que aparece encima es un artefacto de obligar al planificador a un camino
que él no habría elegido con esas estadísticas. Confundir «indexable» con «usa el índice como el ADR
promete» es lo que produjo la falsa alarma.

## Solución

Separar la medición de la ejecución en **dos scripts con siembras independientes**, y medir sin
tocar los interruptores del planificador:

- El que mide envuelve el `EXPLAIN (ANALYZE, BUFFERS)` en una transacción con **`ROLLBACK`**, así
  las filas sembradas siguen ahí al terminar y el `DELETE` real no se persiste.
- El que verifica el criterio de comportamiento (aquí el 6: 5000 filas, purga y drenaje solapados)
  siembra lo suyo aparte y sí ejecuta de verdad.
- `enable_seqscan` se queda en su valor por defecto.

Con eso el plan real apareció como el ADR 0041 prometía, sin `Sort` en ningún nivel:

```
Index Scan using idx_outbox_purgable on "OutboxEvento" (actual time=0.006..0.057 rows=500 loops=1)
  Index Cond: (("procesadoAt" IS NOT NULL) AND ("procesadoAt" < '2026-08-05...'))
```

## Cómo evitarlo

**Antes de leer un `EXPLAIN`, comprueba cuántas filas del caso hay en la tabla en ese momento.** Si
son pocas, el plan no dice nada; si la operación que mides las borra, mide **antes** o en una
transacción con `ROLLBACK`, nunca después. Y no uses `enable_seqscan = off` para concluir que un
índice se usa: eso solo demuestra que la consulta es indexable, y el `Sort` que aparece al forzarlo
es un artefacto, no un hallazgo.

Corolario para los ADR: un ADR que promete una forma de plan (`Index Scan` sin `Sort`, «sin N+1»,
«no bloquea») solo está verificado contra una siembra con volumen. Sin ella es un absoluto sin
respaldo, que es [[E-017]] esperando a morder.
