# E-019: `it.each` con un símbolo que aún no existe revienta el archivo entero

**Área:** tests
**Apariciones:** 1 — F-020 (`qabSync.test.ts` y `qabOutboxLog.test.ts`)

## Síntoma

Un test nuevo, escrito contra un contrato cuyo código todavía no existe, no falla solo él: **tumba
todos los tests del archivo**, incluidos los que estaban en verde y no tienen nada que ver.

```js
it.each(QAB_SLUG_LEARN_OUTCOMES)("...", (outcome) => { ... })
//       ^ undefined mientras el implementer no declare la constante
```

`it.each(undefined)` falla en la fase de **colección**, no en la de ejecución, así que el archivo
entero no llega a montarse.

## Causa raíz

Es un riesgo propio de este pipeline, no un descuido: `dev-tester` e `implementer` corren **en
paralelo y sin verse**, así que durante ese rato todo símbolo del contrato está `undefined` por
diseño. Lo normal y esperado es que los tests nuevos estén rojos. Lo que no es aceptable es que
arrastren a los viejos, porque entonces la suite deja de servir para saber si algo se rompió de
verdad.

Se manifiesta solo al **extender un archivo compartido**. Un archivo de test nuevo que revienta
entero es inocuo: todo lo suyo iba a estar rojo igualmente.

## Solución

Un guard en la parametrización mientras el símbolo no exista:

```js
it.each(QAB_SLUG_LEARN_OUTCOMES ?? [])("...", (outcome) => { ... })
```

Y **quitarlo cuando la constante ya exista**, porque entonces esconde un `undefined` real. Ojo con
la variante que apareció aquí: anotar el `filter` como `readonly string[]` para hacerlo tragar
ensancha la unión literal y produce un `TS2322` en la llamada. La anotación correcta era
`readonly IQabSlugLearnResult["outcome"][]`.

## Cómo evitarlo

**Al extender un archivo de test que ya tiene casos en verde, ningún símbolo del contrato todavía
inexistente puede entrar en la fase de colección.** Dentro del cuerpo de un `it` es inofensivo
—falla ese caso y nada más—; en el argumento de un `it.each`, en un `describe.each` o en cualquier
cosa que se evalúe al montar el archivo, se lleva por delante lo que había.

Y al terminar: `npm test` no basta, hay que mirar **cuántos archivos** fallan y no solo cuántos
tests. Un archivo entero caído se ve igual que un test caído en el recuento total.
