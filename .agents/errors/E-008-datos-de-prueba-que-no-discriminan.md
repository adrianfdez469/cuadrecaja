# E-008: Datos de prueba que no discriminan, y el falso aprobado que producen

**Área:** tests
**Apariciones:** 1 — F-018 (tres veces dentro del mismo feature)

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
