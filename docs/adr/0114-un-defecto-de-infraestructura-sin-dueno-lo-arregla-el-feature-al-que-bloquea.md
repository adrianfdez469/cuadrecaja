# ADR 0114: Un defecto de infraestructura sin dueño lo arregla el feature al que bloquea

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-032 (vender a crédito en el POS), y **transversal** en la regla que sienta

> Autoriza a F-032 a tocar `src/context/MessageContext.tsx`, con el alcance cerrado del § 6.9 de su
> contrato. Es la tercera delegación de este feature, y la **primera sobre un archivo que ningún
> feature posee**: por eso lleva ADR propio y no una nota en el contrato.

## Contexto

El `qa` rechazó F-032 en el ciclo 1 con 14/14 criterios de aceptación verificados ejecutando,
34/36 criterios de diseño en verde, las cinco comprobaciones de seguridad ejecutables pasadas
—incluida la inyección ESC/POS antes y después del fix—, suite 3895/3895, `tsc` y `lint` en exit 0.
Falla **un** punto, el criterio de diseño 32 y la mitad del 31, y no está en ningún archivo de F-032:

con la hoja de cliente abierta y sin conexión, pulsando la acción de alta con un nombre que trae
bytes de control **tres veces seguidas**, el aviso de rechazo **desaparece del DOM en el segundo
clic** —React emite `Encountered two children with the same key`— y en el tercero **reaparece sin su
sufijo `×3`**. Reproducido al 100 % en dos corridas, con captura y log de consola.

La causa está en `src/context/MessageContext.tsx`, dentro de `MessageProviderInner`, y son **dos
fallos encadenados**, verificados leyendo el archivo:

1. `const key = existing?.key ?? (dedupeKey as SnackbarKey)` hace que la `key` sea siempre el mismo
   `dedupeKey`. `closeSnackbar(existing.key)` arranca la transición de salida y el
   `enqueueSnackbar` inmediato monta el nuevo **con la misma `key`** mientras el viejo sigue
   montado: React ve dos hijos con la misma `key` en el mismo commit.
2. El `onExited` **del viejo** hace `activeRef.current.delete(dedupeKey)` sobre la entrada que **el
   nuevo** acaba de escribir. El contador vuelve a 1, y ese es el `×3` que se pierde.

**Es la segunda aparición.** El `qa` de **F-031** ya lo encontró, explorando fuera de sus criterios,
y lo dejó escrito en las `notes` de aquel feature: colisión de `key` al repetir el mismo error dos
veces seguidas, «es un archivo compartido que NINGÚN feature de este epic posee ni toca, así que no
bloquea F-031, pero conviene una ficha de error para quien lo posea». **Nadie abrió la ficha, y
nadie era «quien lo posea», porque no hay quien lo posea.**

Y un dato que pesa más que los dos anteriores: el `ui-designer` de F-032, al escribir su contrato,
**leyó ese mismo archivo y concluyó que el hallazgo de F-031 ya no se reproducía en la versión
actual**. El `qa` lo ejecutó y sí se reproduce. **Leer no bastó** — ni para él, ni para el `qa` de
F-031, ni para quien lo mire la próxima vez.

Dónde bloquea ahora importa: el aviso que desaparece es el del **rechazo del nombre por caracteres
de control**, el estado que el ADR 0113 estrenó, y es la **única** explicación que el cajero recibe.
Sin él no ve nada: el campo se ve con texto normal y un hueco que no parece nada, la venta no
avanza, y no hay ningún otro sitio donde el porqué esté escrito.

## Decisión

**F-032 arregla `src/context/MessageContext.tsx`, con un alcance cerrado y escrito por adelantado en
el § 6.9 de su contrato.**

Solo se toca `MessageProviderInner`. **Las dos firmas públicas no cambian** —`showMessage(text,
severity, persistent?, id?)` y `removeMessage(id)`—, así que los 55 archivos que llaman a la primera
y los seis sitios que llaman a la segunda no se tocan. Tres cambios, y los tres hacen falta:

1. Una `key` **distinta por cada `enqueueSnackbar`**, derivada del `dedupeKey` y del contador.
   `dedupeKey` sigue siendo la identidad de deduplicación y la clave del `Map`; deja de ser la `key`
   del snackbar.
2. El `onExited` **solo borra si la entrada del `Map` sigue siendo suya**, comparando la `key` que
   recibe con la que el `Map` guarda ahora.
3. `removeMessage(id)` cierra **la `key` que el `Map` guarda**, no `id`.

Y la regla general que esto sienta, que es la razón de que sea un ADR y no una nota:

> **Un defecto verificado en infraestructura compartida que ningún feature posee lo arregla el
> feature al que bloquea, con el alcance escrito por adelantado.** Ni se rodea con un parche local,
> ni se difiere a un dueño que no existe.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Un guard en `CheckoutView.handleNameOnly`** para no reinvocar `showMessage` mientras el término no cambie | Es la opción que parece más segura y es la peor de las dos. **Primero**, no arregla nada: suprime el segundo aviso en vez de mostrarlo, así que los criterios de diseño 31, 32 y 35 —que verifican precisamente el `×2` y el `×3`— **habría que reescribirlos a la baja** para que aceptaran el comportamiento del parche. Un arreglo que obliga al contrato a bajar su propio listón no es un arreglo. **Segundo**, es exactamente el patrón que el propio diseño ya rechazó por escrito en su § 6 («no se atenúa ni se bloquea la acción de crear después del rechazo … sería una guarda con memoria que nadie sabría deshacer», **E-032**), reintroducido un nivel más arriba. **Tercero**, deja el defecto vivo para el siguiente que dispare un error en ráfaga — y ya sabemos que hay un siguiente, porque hubo un anterior |
| **Diferirlo: anotar el defecto, abrir la ficha y no bloquear F-032** | Es lo que se hizo en F-031, y el resultado está a la vista: la ficha no se abrió, el defecto no se arregló, y volvió doce días después bloqueando un criterio en un camino peor. La segunda vez que una decisión produce el mismo resultado, deja de ser una decisión y pasa a ser un hábito. Además, el aviso que desaparece es aquí la única explicación que el cajero recibe: diferirlo es entregar a sabiendas un estado en el que el usuario no ve nada |
| **Abrir un feature propio para `MessageContext.tsx`** | Correcto en abstracto y equivocado en el calendario: mete una dependencia entre features en el cierre de un epic de nueve, para un archivo cuyo arreglo cabe en tres cambios dentro de una función. Y no resuelve la pregunta de fondo —quién lo posee—, solo la aplaza otro turno |
| **Arreglarlo entero: revisar toda la deduplicación, `maxSnack`, las transiciones** | Es infraestructura compartida por 55 archivos a las puertas del cierre. El alcance del § 6.9 es el mínimo que cierra el criterio 32 y ni un cambio más: `maxSnack`, `anchorOrigin`, el `action` del botón de cerrar, `shouldPersist` y el `autoHideDuration` **no se tocan**, y ninguno tiene nada que ver con este defecto |
| **Cambiar solo la `key` y no el `onExited`** | Cierra la colisión de React y deja el contador roto: el `×3` se seguiría perdiendo, que es la otra mitad del criterio 32. Los dos fallos están encadenados y ninguno de los dos arreglos es suficiente solo |
| **Cambiar la `key` sin tocar `removeMessage`** | Rompería algo que hoy funciona, y en el camino principal del producto: con `key` única, `id` deja de ser la `key` de ningún snackbar y `removeMessage(SALE_PROCESSING_MSG_ID)` no cerraría nada, así que el aviso «Procesando venta…» **se quedaría en pantalla para siempre** en cada cobro. Cambiar un bug de un aviso repetido por un bug en el camino de cobro es un mal negocio, y es la razón de que el tercer cambio no sea opcional |

## Consecuencias

**A favor:**

- El criterio de diseño 32 se cierra **arreglando**, no bajando el listón, y con él la mitad del 31
  y el 35.
- La clase entera queda cerrada para todo el producto: cualquier error en ráfaga —los reintentos de
  sincronización, los 409 de F-031, lo que venga— vuelve a mostrar su `×N` en vez de desaparecer.
- El alcance está escrito **antes** de tocar nada (§ 6.9), con su comportamiento observable y con la
  lista explícita de lo que no se toca. El ciclo 2 es un encargo cerrado, no una investigación.
- La regla que sienta responde a la pregunta que F-031 dejó sin responder —«quien lo posea»— con
  algo verificable: lo posee, para este arreglo, quien lo necesita.

**En contra / coste asumido:**

- **F-032 toca infraestructura compartida en su cierre.** Es el riesgo real: `showMessage` lo llaman
  55 archivos. Se acota manteniendo las dos firmas intactas y limitando el diff a una función, pero
  el riesgo no es cero, y la no-regresión del aviso «Procesando venta…» es obligatoria en el ciclo 2
  precisamente por eso.
- **Es la tercera delegación de este feature, y de una clase distinta.** Las de los ADR 0111 y 0113
  eran sobre archivos de **F-029 y F-031**, features del mismo epic con dueño identificable y
  contrato cerrado. Esta es sobre un archivo que **nadie** posee. La figura se parece; el
  razonamiento no, y por eso está escrito aparte.
- **La regla se puede leer de más.** «El feature al que bloquea lo arregla» no es permiso para tocar
  infraestructura cuando estorba: exige un defecto **verificado ejecutando**, que **bloquee un
  criterio**, y un alcance **escrito por adelantado y aprobado**. Sin las tres cosas, se vuelve al
  `arch-guardian`.
- **El defecto no queda cubierto por la suite.** `MessageContext.tsx` es un `.tsx` y este proyecto
  no tiene `@testing-library/react`. Se verifica ejecutando, y eso significa que una regresión
  futura solo la atrapa el `qa` del feature que vuelva a mirarlo. No se extrae un símbolo puro
  artificial para simular cobertura: el defecto vive en la interacción con el ciclo de vida de
  `notistack`, y una función pura pasaría siempre sin probar nada.

**Impacto en seguridad y escalabilidad:**

- **Seguridad, indirecta pero real.** El aviso que desaparecía es el del rechazo por caracteres de
  control (ADR 0113), y es la única realimentación del único control de esa clase que el cajero ve.
  Un control de seguridad cuya explicación se borra sola empuja al usuario a repetir el gesto que se
  está refusando. El mensaje sigue siendo **fijo y sin interpolación**: este arreglo no cambia una
  coma del texto y no introduce ninguna vía de citar el valor rechazado (**E-031**).
- **Escalabilidad:** ninguna. El `Map` de deduplicación tiene una entrada por texto distinto vivo, y
  ese número no cambia; lo único que cambia es qué cadena se usa como `key` de cada snackbar.
- **Reversión:** barata y aislada. Es un diff dentro de una función, sin datos, sin migración y sin
  cambio de firma. Volver atrás devuelve el defecto y nada más.
