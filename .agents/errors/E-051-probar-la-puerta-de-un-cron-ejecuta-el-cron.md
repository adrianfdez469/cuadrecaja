# E-051: probar la puerta de autenticación de un cron **ejecuta el cron**

**Área:** tests
**Apariciones:** 1 — F-008

## Síntoma

Verificando que el cron nuevo de F-008 era *fail-closed*, la llamada de control —la que **sí**
tiene que pasar, con el `CRON_SECRET` correcto— devolvió `200` como se esperaba. Y de paso:

- Ejecutó una **corrida real sin acotar** que alcanzó `Tienda Principal`, una tienda preexistente
  ajena al feature.
- La marcó divergente **de verdad** (`local products=2` vs `QAB products=21`, por un desfase real
  de `monedaPrecioCode` nulo en 40 de sus 42 filas, de otro trabajo en curso).
- Puso las **42** filas de `ProductoTienda.dispPublicada` de esa tienda en `NULL`.
- Creó una `Notificacion` de divergencia para ese negocio.

## Causa raíz

Un handler de cron **no tiene modo *dry-run***: la puerta de autenticación y el trabajo viven en el
mismo `GET`. Comprobar la puerta con la credencial correcta es, necesariamente, **ejecutar la
orquestación completa** — y sin parámetros, sobre **todo lo elegible que haya en la base de
desarrollo**, incluidas las filas de otro feature o de una sesión de QA anterior.

Las tres llamadas de «no pasa» (sin cabecera, secreto incorrecto, `Bearer undefined`) son gratis
porque cortan antes. **La cuarta no lo es**, y es fácil no verlo: se está pensando en la guarda, no
en el cuerpo.

Nada falló. El comportamiento fue **exactamente el diseñado** — marcar divergente y recuperar. El
error fue de **alcance de la prueba**, no de código.

## Solución

Se detectó en la misma sesión y se reconstruyó el estado previo antes de cerrar:

- Se restauraron los 21 `dispPublicada` que tenían valor real (`OUT_OF_STOCK`), a partir de una
  consulta hecha **minutos antes de tocar nada** — sin esa lectura previa no habría habido nada que
  restaurar.
- Se borraron las 3 filas de `QabReconciliacionTienda` que la corrida creó para tiendas
  preexistentes (la tabla tenía **0** filas al empezar).
- Se borró la `Notificacion` generada.
- Se verificó la distribución final exacta: 21 `OUT_OF_STOCK` / 21 `null`, tabla de reconciliación
  de vuelta a 0 filas.

## Cómo evitarlo

**Al probar la puerta de un cron con efectos secundarios reales, usa el parámetro de acotación del
propio contrato también en la llamada que SÍ pasa**, nunca solo en las que rebotan:

```
Authorization: Bearer $CRON_SECRET     →  /api/crons/<x>?tiendaId=<la mía>
```

Y antes de la primera llamada con la credencial buena, **captura el estado que puedas necesitar
restaurar**. Aquí lo que salvó la limpieza fue una consulta previa que se había hecho por otro
motivo; no siempre habrá esa suerte.

Hermano de **E-040** (colisión de fixtures entre verificaciones concurrentes) y de **E-025** (un
subagente que ejecuta contra la misma base): la diferencia es que aquí no hay concurrencia ni
desvío de mandato — **una sola verificación, dentro de su alcance, alcanza datos ajenos porque el
comando no tiene forma de acotarse por defecto**.
