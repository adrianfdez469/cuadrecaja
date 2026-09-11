# E-084: El `tsc` de árbol completo tampoco es señal limpia durante el paso 5

**Área:** build
**Apariciones:** 1 — F-041 (`implementer`, reescribiendo `zoneTariffPrecedence.ts`)

## Síntoma

El `implementer` termina sus ficheros, corre la comprobación obligatoria y la encuentra en rojo:

```
npx tsc --noEmit   → exit 1
```

Los errores no están en ninguno de los ficheros que acaba de escribir. Están en un archivo de
`src/__tests__/**`, que es la frontera del **otro** agente del paso 5 y que él tiene prohibido
tocar. Y no puede esperar a que se arregle solo: el rojo dura hasta que el `dev-tester` aterrice
sus ficheros, que puede ser mucho después.

## Causa raíz

El paso 5 corre `implementer` y `dev-tester` **en paralelo y sin verse**, con fronteras de
escritura disjuntas. La invariante que hace que eso funcione es que ninguno necesite leer el
trabajo del otro. **Un contrato que manda SUSTITUIR un fichero preexistente rompe esa invariante
para las herramientas de árbol completo**, aunque no la rompa para la escritura.

En F-041 el § 1 del contrato mandaba reescribir una pareja heredada de F-026:
`src/lib/tiendaOnline/zoneTariffPrecedence.ts` (del `implementer`) y
`src/__tests__/zoneTariffPrecedence.test.ts` (del `dev-tester`). En cuanto el `implementer`
reescribe el suyo a la forma nueva, el test viejo —que sigue en disco, llamando a una función
retirada y con el orden de parámetros anterior— deja de compilar. El árbol está en un estado
intermedio **legítimo y esperado**, y `tsc` no tiene forma de saberlo.

Es hermano de E-045 y de E-026, y la diferencia es la que importa: E-045 dice que el `lint` con un
pipe miente sobre su exit code, y E-026 dice que la suite en verde no implica `tsc` limpio. Este
dice algo que ninguno de los dos cubre — **`tsc` en rojo tampoco implica que TU código esté mal**,
cuando corres dentro de una ventana de paralelismo.

## Solución

El `implementer` verificó sus ficheros con un `tsconfig` temporal en la raíz que extendía el real
y excluía ese único archivo ajeno, creado y borrado en el mismo comando. Es el arreglo correcto
porque **no toca nada de la frontera ajena**: ni la arregla, ni la borra, ni la espera.

El arreglo que NO se hace, y hay que decirlo porque es el instinto: borrar o "arreglar de paso" el
test viejo. Eso es escribir en la frontera del otro agente, y además destruye la propiedad que
justifica todo el paso 5 —que los tests se escriban sin ver la implementación—.

## Cómo evitarlo

**Cuando un contrato manda sustituir un fichero preexistente, tiene que decir además qué
herramienta de árbol completo va a estar en rojo mientras dure el paso 5, y cuál es la señal
válida entre tanto.** El § 1 de F-041 asignó correctamente cada fichero a su agente, y aun así no
previó esto: asignar el fichero no basta, porque el rojo no lo produce quien escribe, lo produce
quien **todavía no ha escrito**.

Dos consecuencias prácticas:

- Para el `implementer` y el `dev-tester`: antes de reportar un `tsc` o un `lint` en rojo, mira
  **en qué fichero** están los errores. Si están todos al otro lado de tu frontera y el contrato
  mandaba sustituir ese fichero, no es tu rojo. Verifica lo tuyo aislándolo y repórtalo así.
- Para el coordinador: un `tsc` en rojo a mitad del paso 5 no es motivo para interrumpir a nadie.
  La comprobación que vale es la de después, con los dos agentes aterrizados — que en F-041 dio
  exit 0 limpio.
