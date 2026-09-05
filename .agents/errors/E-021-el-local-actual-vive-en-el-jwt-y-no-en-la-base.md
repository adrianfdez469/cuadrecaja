# E-021: El local actual vive en el JWT de la sesión, no en la base

**Área:** auth
**Apariciones:** 1 — F-020 (verificación en navegador del `qa`)

## Síntoma

Se cambia `Usuario.localActualId` en la base para poner al usuario en el local que hace falta
verificar, se recarga la pantalla y **el navegador sigue mostrando el local de antes**. No hay error;
la fila está cambiada y la pantalla la ignora.

## Causa raíz

El local actual se resuelve desde el **JWT de la sesión**, que NextAuth acuñó al iniciarla, no de una
lectura en vivo de la base. Mientras esa sesión viva, la fila de la base es irrelevante para lo que
el navegador ve.

Cuesta un ciclo entero de diagnóstico porque el síntoma apunta al sitio equivocado: parece que la
pantalla no refresca, o que hay una caché de datos, y se acaba buscando en la capa de servicios lo
que está en la de autenticación.

## Solución

Recrear la sesión: cerrar sesión y volver a entrar después de cambiar la fila. Para sembrar un caso
de verificación, el orden correcto es **cambiar la base primero y hacer login después**, no al revés.

## Cómo evitarlo

**Antes de sembrar un caso cambiando una fila, comprueba si ese dato viaja en el JWT.** Si viaja, la
fila no es la fuente de verdad de lo que verás: la sesión lo es.

Es el mismo género de trampa que [E-002](E-002-servidor-dev-con-cliente-prisma-viejo.md) —un estado
cacheado que hace que la verificación mienta— pero en la capa de sesión en vez de la del cliente de
Prisma. Cuando una verificación en navegador «no ve» un cambio que la base sí tiene, esos dos son los
dos primeros sospechosos.
