# E-063: Varios agentes mutando el mismo árbol de trabajo a la vez

**Área:** build
**Apariciones:** 1 — F-030 (QA)

## Síntoma

Tres agentes de verificación lanzados en paralelo contra **el mismo árbol de trabajo** y el mismo
servidor de desarrollo con recarga en caliente. Dos de ellos mutaron los mismos archivos de
`src/` a la vez —uno por su cuenta, sin que se le hubiera pedido— y el agente dedicado a la
auditoría por mutación informó de «mutaciones apareciendo y desapareciendo en disco» ajenas a él.

Los veredictos resultaron ser correctos, pero **no había forma de saberlo mientras ocurría**: cada
cifra podía venir de un árbol distinto del que su autor creía estar midiendo.

## Causa raíz

La auditoría por mutación consiste en **romper el código a propósito** y comprobar que un test se
pone rojo. Es incompatible con cualquier otra lectura concurrente del mismo árbol: mientras dura
la mutación, todo lo que otro agente mida está midiendo código roto — o peor, código roto de otra
manera.

Y no basta con no mutar: un `git checkout` para revertir **borra el trabajo sin commitear de los
demás**, que es la forma en que este error se cruza con [[E-052]].

## Solución

Se reconstruyó la cadena de custodia **después**: sobre el árbol ya quieto se repitieron el
`git diff --stat`, un `grep` de residuos de mutación, una sonda directa importando la función pura
y evaluándola a mano, y la suite completa. Ninguna cifra citada por un agente paralelo se aceptó
como autoritativa sin repetirla.

## Cómo evitarlo

- **La auditoría por mutación se hace en serie y sola**, con el árbol quieto y nadie más leyendo.
- Las mutaciones se revierten con la edición inversa exacta, **nunca** con `git checkout` sobre un
  archivo que lleva trabajo sin commitear ([[E-052]]).
- Si de todos modos hubo concurrencia, **la cifra no vale hasta repetirla** sobre el árbol quieto.
  Un número medido durante una mutación ajena es indistinguible de uno correcto.
- Al repartir trabajo entre agentes paralelos, dales fronteras **disjuntas de escritura**, que es
  lo que hace seguro el paso de implementación y tests del pipeline. Si dos pueden escribir el
  mismo archivo, no pueden correr a la vez.
