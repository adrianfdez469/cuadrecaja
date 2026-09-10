# E-035: La lista de testabilidad del contrato se cierra antes de que el diseño añada sus símbolos

**Área:** build
**Apariciones:** 4 — F-011 · F-012 · F-021 · F-034

## Síntoma

El contrato de interfaces trae una sección que enumera **qué símbolos cubre la suite y cuáles no**
(§9.4 en F-011, §8.4 en F-012). El `arch-guardian` la escribe en el paso 4. El `ui-designer`
trabaja en el paso 4b y, para dictar el copy, **añade funciones puras al mismo módulo** que esa
lista enumera.

Resultado: la lista queda incompleta en cuanto el diseño se cierra, y nadie la actualiza.

- **En F-011** lo detectó el propio `ui-designer` al entregar: el contrato nombraba dos símbolos de
  `orderPresentation.ts` y el diseño necesitaba **cinco más**. Hubo que devolvérselo al arquitecto
  antes de poder lanzar el paso 5.
- **En F-012** lo detectó el `dev-tester`: cuatro funciones de copy (`orderStatusFailureCopy`,
  `orderStatusConfirmTitle`, `orderStatusAppliedNotice`, `orderStatusDivergedNotice`) **no estaban
  en §8.4**. Las cubrió igualmente y lo dejó anotado en el propio archivo de test.

## Causa raíz

**Un orden de pipeline, no un descuido de nadie.** El paso 4 (contrato) precede al 4b (diseño), y
el contrato tiene que estar cerrado antes porque es el gate que permite paralelizar el paso 5. Pero
la lista de testabilidad depende de algo que **todavía no existe** cuando se escribe: los símbolos
que el diseño va a necesitar para dictar sus palabras.

El daño no es que falten tests. Es doble y más sutil:

1. Si el hueco **no se detecta**, el `implementer` inventa los símbolos y el `dev-tester` no los
   prueba, porque programan en paralelo y sin verse. Y si el tester los mete en un `it.each` antes
   de que existan, tumba el archivo entero (**E-019**).
2. Si el hueco **se detecta tarde**, el `qa` que audite la cobertura contra esa lista al pie de la
   letra verá símbolos que «sobran» y puede leerlo como desviación.

## Solución

En los dos casos se resolvió igual, y funcionó: **el coordinador devolvió el hueco al
`arch-guardian`** con el encargo acotado de ampliar solo esa sección, antes de lanzar el paso 5.
En F-012 el `dev-tester` además dejó la anomalía escrita dentro del archivo de test, para que el
`qa` no la interpretara mal.

## Cómo evitarlo

- **El coordinador comprueba el cruce al volver el `ui-designer`, siempre**, antes del paso 5: si
  el diseño nombra funciones puras que el contrato no enumera, se devuelve al arquitecto. No es una
  incidencia rara: pasó en los dos features seguidos que tuvieron pantalla.
- Considerar el arreglo de fondo: que la sección de testabilidad del contrato se cierre **después**
  del paso 4b, o que el `ui-designer` tenga que declarar explícitamente en su entrega la lista de
  símbolos puros que añade. Lo segundo es más barato y ya lo hizo espontáneamente en F-011.
- Mientras tanto, el `qa` debe saber que **una divergencia entre la lista y los tests puede ser
  intencional**, y buscar la anotación antes de tratarla como fallo.

---

## Adenda F-021 — la misma forma, un escalón más arriba

En F-021 el contrato fijó un **enum literal** (`ROUTE_GUARD_KINDS`) y lo usó a la vez como
vocabulario de un **censo de 229 entradas que nadie había recorrido entero todavía**. Al llegar a
las entradas reales apareció un caso que el vocabulario no podía expresar: «acotada por el
`negocioId` de la sesión sobre un modelo que no está en el camino de relaciones».

El `implementer` lo describió así, y es el diagnóstico exacto:

> Un contrato que fija un enum literal y a la vez lo usa como vocabulario de un censo que nadie
> recorrió entero.

Para entonces el enum ya lo importaba el `dev-tester` en paralelo, así que **cambiarlo costaba más
que convivir con él**: se ensanchó el significado de un valor existente y cada entrada explica su
mecanismo real en su motivo.

**La regla:** un campo cuyo dominio solo se conoce al recorrer los datos **nace como texto libre con
una lista sugerida**, no como enum cerrado. Se cierra después, cuando el recorrido ha terminado y se
sabe qué valores existen de verdad.

Es la misma forma que esta ficha describe —un vocabulario que se cierra antes de que exista lo que
tiene que nombrar— aplicada al contenido de un censo en vez de a una lista de símbolos.

## Adenda F-034 — la lista dio por testable un símbolo que no estaba exportado

El contrato listó `cierreStoredTotalsSchema` en su lista de testabilidad, y el `dev-tester` escribió
tests que lo importaban. Era `const` **sin `export`**.

Lo que hace que valga una adenda es **dónde iba a aparecer el síntoma**: no en la implementación,
que compila exactamente igual con o sin el `export`, sino en el otro lado del paso 5, como un
**import roto que tumba el archivo de tests entero en la fase de colección**
([E-019](E-019-it-each-con-un-simbolo-que-aun-no-existe.md)) — incluidos los tests que estaban en
verde. Un fallo lejos de su causa, en la frontera del agente que no lo provocó.

La forma es la misma que la de la ficha: **la lista de testabilidad se cierra sin ejecutar nada
contra el árbol real.** Antes era el diseño el que llegaba tarde; aquí es que nadie comprobó que
los símbolos prometidos se pudieran importar.

### La regla

Cerrar una lista de testabilidad cuesta un comando: por cada símbolo que promete, un `import` real
—`npx tsx -e "import('@/…').then(m => console.log(Object.keys(m)))"`— o un `grep` de `export`. Un
símbolo que el contrato promete y el módulo no exporta no es un descuido de redacción: es un
archivo de tests entero caído en el agente de al lado.
