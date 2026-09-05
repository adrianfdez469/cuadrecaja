# E-040: Colisión de fixtures entre dos verificaciones concurrentes sobre la misma base de desarrollo

**Área:** tests
**Apariciones:** 1 — F-014

## Síntoma

A mitad de una verificación, los datos sembrados **desaparecen**. Las consultas que funcionaban
dejan de devolver filas y los conteos dejan de cuadrar, sin ningún error: simplemente ya no está lo
que se acababa de sembrar.

El primer diagnóstico apuntó a un cron o a una migración fantasma. Ninguna de las dos cosas.

## Causa raíz

**Otro proceso estaba corriendo su propia verificación del mismo feature contra el mismo Postgres
local**, sembrando negocios con un prefijo parecido (`F014-*` frente a `QA-F014-*`), y su rutina de
limpieza barría con un patrón **lo bastante amplio como para llevarse también los ajenos**.

Las dos verificaciones eran correctas por separado. El problema es que la base de datos de
desarrollo es **un recurso compartido** y ninguna de las dos lo trataba como tal.

Es pariente de [E-025](E-025-un-subagente-se-desvia-de-su-mandato-y-contamina-el-entorno.md), pero
no es lo mismo: allí un subagente se sale de su mandato; aquí **los dos procesos están dentro del
suyo** y aun así se pisan, porque el mandato no dice nada de la base.

## Solución

Resembrar y repetir la verificación cuando el otro proceso había terminado.

## Cómo evitarlo

1. **Prefija todo dato de verificación con algo verdaderamente único**: timestamp + aleatorio.
   **Nunca solo el nombre del feature** — es exactamente lo que va a usar el otro proceso que
   trabaja en ese mismo feature.
2. **Comprueba antes de sembrar, no solo al limpiar.** Un `grep` o un `SELECT` por prefijo antes de
   empezar delata al otro proceso cuando todavía se puede esperar.
3. **La limpieza borra por el prefijo propio y exacto**, nunca por uno que empiece por el nombre del
   feature.

Y para quien coordina: **documentos en paralelo, sí; base de datos y navegador compartidos, no.**
En esta misma sesión se retuvo a propósito un `ui-designer` para que no moviera el viewport bajo un
`qa` que estaba capturando, y se evitó solapar dos `implementer`. La base de datos merece el mismo
cuidado, y es más fácil de olvidar porque no se ve.
