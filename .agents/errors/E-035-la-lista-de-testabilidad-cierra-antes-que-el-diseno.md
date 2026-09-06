# E-035: La lista de testabilidad del contrato se cierra antes de que el diseño añada sus símbolos

**Área:** build
**Apariciones:** 2 — F-011 · F-012

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
