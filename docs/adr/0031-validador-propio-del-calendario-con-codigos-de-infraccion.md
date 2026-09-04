# ADR 0031: El calendario se valida con un recolector propio de infracciones, no con los mensajes de Zod

**Estado:** aceptado
**Fecha:** 2026-09-03
**Feature:** F-005
**Se apoya en:** contrato QAB v9, § «Cambios respecto a la v8» punto 1 · § «Vocabulario de errores»

## Contexto

La v9 del contrato convierte `openingHours` de «cualquier JSON» en un objeto validado, y lo hace
con una trampa que decide toda la arquitectura de este trozo: **un calendario malformado no se
descarta a sí mismo, rechaza el evento `STORE` entero** con `STORE_OPENING_HOURS_INVALID`. El
`name` y el `phone` corregidos que viajaran en el mismo evento tampoco se aplican, el aviso llega
solo como una entrada del `failed[]` de un `207`, y el outbox de F-002 reintenta las seis veces
con el mismo resultado. La validación tiene que ocurrir **en cuadrecaja, antes de encolar**.

Hasta aquí no hay decisión que tomar: la impone el contrato. La decisión está en **cómo se le
cuenta al comerciante qué regla incumplió**. El criterio 8 de F-005 no pide un rechazo, pide un
rechazo que *nombre la infracción concreta*, y enumera catorce violaciones distintas —desde
`version` distinta de `1` hasta un JSON de más de 2 KB— que la pantalla tiene que poder
diferenciar.

Un `z.strictObject` anidado valida las catorce, pero lo que produce cuando falla son los mensajes
por defecto de Zod (`"Unrecognized key(s) in object"`, `"Invalid input"`) en el idioma de la
librería y con la forma que la librería decida. Construir la copia de la pantalla haciendo
arqueología sobre esos mensajes acopla la UI a la versión de Zod, y un `npm update` la rompe sin
que falle ningún tipo. El repositorio ya tiene el precedente contrario en `qabSlugSchema`
(`src/schemas/qabStore.ts`), que es un `z.unknown().transform((input, ctx) => ...)` con su propio
`ctx.addIssue`, precisamente para no depender de eso.

Hay además dos huecos que el contrato **no cierra** y que alguien tiene que cerrar en algún sitio,
porque implementador y tester los resolverían distinto: si dos ventanas que se tocan
(`{09:00→13:00}` y `{13:00→18:00}`) se consideran solapadas, y si la ventana que cruza la
medianoche tiene que comprobarse contra la primera ventana del día siguiente.

## Decisión

**Una función pura, `collectOpeningHoursIssues(input: unknown): IOpeningHoursIssue[]`, es la
autoridad única sobre la validez de un calendario.** Devuelve la lista completa de infracciones,
cada una con un `code` de un enum cerrado de diecisiete valores y un `path` que localiza al
culpable (`["days","tue",1,"from"]`). Lista vacía significa válido.

`openingHoursSchema` se construye **encima** de esa función, con el patrón que `qabSlugSchema` ya
usa: `z.unknown().transform((input, ctx) => ...)` que vuelca cada infracción en un `ctx.addIssue`
con el código en `message` y el `path` de la infracción. Así hay un único cuerpo de reglas y dos
puertas de entrada: el schema para las fronteras que ya validan con Zod (el body del `PATCH`, el
payload antes de encolar), y la función pura para la pantalla, que necesita la lista entera para
decir *cuál* regla se incumplió.

Tres reglas de forma que hacen la salida predecible, y que existen para que el tester pueda
escribir aserciones exactas sin ver la implementación:

1. **Las comprobaciones corren en un orden fijo**, de fuera hacia dentro: tamaño serializado →
   forma de la raíz → claves desconocidas de la raíz → `version` → forma de `days` → claves de
   `days` → por día, en orden `mon…sun`, la forma del día, el número de ventanas, cada ventana de
   izquierda a derecha, y por último las reglas entre ventanas del mismo día.
2. **Una comprobación que necesita un valor bien formado se salta cuando ese valor ya produjo una
   infracción.** No se comprueba el solape de un día cuyas horas no son `HH:MM`: produciría un
   segundo código derivado del primero y ruido en la pantalla.
3. **`SIZE_EXCEEDED` se comprueba primero y corta.** Un calendario de 2 MB no se recorre para
   contarle al comerciante que además tiene un día de menos.

Y los dos huecos del contrato, cerrados aquí porque no los cierra él:

- **Dos ventanas que se tocan no se solapan.** Hay solape cuando `from[i] < to[i-1]`, no cuando son
  iguales. `{09:00→13:00}` y `{13:00→18:00}` es un horario partido legítimo y frecuente.
- **La ventana que cruza la medianoche no se comprueba contra el día siguiente.** Se comprueba que
  sea la última del día y que empiece después de que termine la anterior; que su cola invada la
  primera ventana del día siguiente no se valida, porque el contrato no dice qué debería pasar y
  queandabuscando no lo rechaza. Inventar la regla aquí rechazaría calendarios que el otro lado
  acepta, que es peor que no comprobarla.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `z.strictObject` anidado y leer `error.issues` en la pantalla | Acopla la copia de la UI a los mensajes por defecto de Zod. Un cambio de versión de la librería rompe la pantalla sin romper ningún tipo y sin fallar ningún test de tipos |
| `z.strictObject` con un `error` personalizado por nivel | Funciona para el tipo y para las claves desconocidas, pero no para las reglas entre ventanas (orden, solape, medianoche), que necesitan un `superRefine` de todos modos. Quedaría el vocabulario partido en dos mecanismos |
| Devolver solo la primera infracción | El criterio 8 se verifica con catorce casos de uno en uno, así que pasaría igual; pero un comerciante que configura siete días quiere ver los tres errores que tiene, no uno por intento de guardado |
| Validar solo en el servidor | La pantalla tiene que nombrar la infracción **mientras** se edita. Con la función pura compartida, cliente y servidor aplican literalmente el mismo cuerpo de reglas: no hay dos validadores que puedan divergir |
| Confiar en el rechazo de queandabuscando | Es exactamente lo que la trampa de la v9 castiga: llega seis reintentos tarde, y arrastra al fracaso los demás campos del mismo evento |

## Consecuencias

**A favor:**
- Un vocabulario cerrado de infracciones que la UI mapea a copy en español con un `Record`, y que
  el `dev-tester` puede afirmar por código sin depender de ningún texto.
- Un único cuerpo de reglas para el cliente, el handler y el constructor del payload. Tres
  fronteras, una implementación.
- Cambiar la copia de un error es tocar un mapa de strings, no el validador.

**En contra / coste asumido:**
- Se escribe a mano lo que una librería haría: unas 120 líneas de comprobaciones y su suite. El
  precio de no depender de los mensajes de un tercero.
- Si la v10+ del contrato cambia una regla del calendario, hay que tocar código propio y no un
  schema declarativo. Es visible y está cubierto por tests, que es lo que importa.
- Los dos huecos cerrados arriba son decisiones nuestras, no del contrato: si queandabuscando
  algún día publica una regla distinta para el solape o para el cruce de medianoche, este ADR es
  el sitio donde consta que elegimos la interpretación permisiva a propósito.

**Impacto en seguridad y escalabilidad:**
- `SIZE_EXCEEDED` **antes** de recorrer nada acota el trabajo que un body hostil puede provocar:
  el validador nunca camina una estructura de más de 2 KB serializados.
- El validador es puro y sin E/S: no consulta la base, no depende del tenant y no puede filtrar
  nada entre negocios.
- Reversión inmediata: es una función y su schema, sin migración ni dato persistido.
