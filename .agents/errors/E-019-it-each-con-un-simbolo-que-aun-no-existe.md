# E-019: `it.each` con un símbolo que aún no existe revienta el archivo entero

**Área:** tests
**Apariciones:** 2 — F-020 (`qabSync.test.ts` y `qabOutboxLog.test.ts`), F-039 (`zoneTariffPrecedence.test.ts`)

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

---

## Adenda F-021 — un `throw` a nivel de módulo hace lo mismo

El `dev-tester` puso la guarda «el inventario tiene al menos 37 entradas» como un `throw` en el
**tope del módulo**, para que fallara alto si el censo aún no existía. Y falló alto: se llevó por
delante los **seis casos de saneamiento de `matchesWhere` del mismo archivo**, que no dependían del
inventario y estaban en verde.

Lo cambió a un `it()` real. Falla igual de visible, y no arrastra a nadie.

**La regla de esta ficha es más ancha de lo que su título sugiere:** no es solo `it.each` con un
símbolo `undefined`. Es **cualquier cosa que se evalúe durante la fase de colección** — un `throw`
de módulo, un import que revienta, un schema de Zod que se construye en el tope. Todo eso tumba el
archivo entero y no solo su propio caso.


---

## Adenda F-039 — el mismo fallo sin ningún símbolo ausente, y quien lo encontró fue el propio autor

La ficha de arriba nace de un símbolo que aún no existía. F-039 llegó al **mismo colapso de
colección sin que faltara ningún símbolo**: la causa fue un `JSON.parse` de un *fixture* colocado a
nivel de `describe`, alimentando la tabla de un `it.each`.

El fixture era `src/__tests__/fixtures/zoneTariffPrecedenceVector.md`, la copia commiteada de un
vector de pruebas fijada por `sha256`. Y el detalle que lo vuelve grave: **el propio criterio de
aceptación mandaba romperle un byte** para comprobar que el test lo detectaba. Con el parseo fuera
del cuerpo de un `it`, esa mutación no ponía en rojo los 17 tests que dependen del vector — tumbaba
el archivo entero, los 34, incluidos los 11 que no lo tocan (`formatZoneDeliveryFee`, los casos
escritos a mano, la comprobación de pureza). El informe habría dicho «el test detecta la mutación»,
y habría sido verdad en la letra y falso en lo que importa.

**La solución fue estructural, no un `try` por encima:** ningún `JSON.parse` vive fuera del cuerpo
de un `it`, y la tabla del `it.each` se construye con una función que atrapa el error y devuelve 13
marcadores —con los `id` conocidos estáticamente— garantizados a fallar, en vez de abortar la
colección. Repetida la mutación, caen exactamente los 17 que dependen del vector y los otros 17
siguen verdes. El agente `qa` lo reprodujo después con esos mismos números.

**Lo que esta aparición añade a la regla:** no es «cuidado con `it.each` sobre un símbolo que no
existe», es más ancho — **cualquier cosa que pueda lanzar durante la colección convierte un test
preciso en un interruptor de todo o nada**, y eso incluye leer y parsear un fichero, que parece
inofensivo porque el fichero está commiteado ahí al lado. Y lo encontró el `dev-tester` mutando su
propio borrador antes de entregarlo: la autoevaluación de quien escribe el test es una hipótesis,
**la mutación es lo único que la mide** (E-008).
