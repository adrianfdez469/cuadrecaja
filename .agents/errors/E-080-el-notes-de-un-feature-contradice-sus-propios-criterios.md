# E-080: El `notes` de un feature contradice sus propios `acceptance_criteria`

**Área:** build
**Apariciones:** 1 — F-037 (paso 4, detectado por el `arch-guardian`)

## Síntoma

No hay mensaje de error. Hay dos frases del **mismo** objeto de `.agents/features.json` que no
pueden ser ciertas a la vez, y un agente que implemente la que no toca deja criterios
**inalcanzables**: no fallan, simplemente no se puede llegar a ejecutarlos.

En F-037, el `notes` prescribía la solución:

> «Se anade una TERCERA razon de bloqueo […]: una venta con **deuda viva** no admite borrar
> productos ni borrarse.»

Y dos de sus propios criterios esperaban lo contrario:

> 7. «Borrar una venta a credito **SIN abonos** elimina tambien su CuentaPorCobrar […]»
> 8. «Borrar un producto de una venta a credito **SIN abonos** descuenta el ajuste PRIMERO del
>    credito […] el credito baja a 100 y el efectivo no se mueve.»

Una venta a crédito sin ningún abono tiene el saldo íntegro pendiente, o sea **deuda viva**. Si la
deuda viva bloquea, esas dos operaciones nunca ocurren y sus criterios no se pueden verificar
ejecutando nada — que es lo único que el backlog acepta como verificación.

## Causa raíz

El `notes` se redacta **antes** de mirar el código y es prosa de síntesis; los
`acceptance_criteria` se escriben para ser ejecutados y suelen llevar cifras trabajadas. Cuando el
`notes` pasa de describir el problema a **prescribir la solución** —«se añade una tercera razón de
bloqueo, y es esta»— entra en el terreno de los criterios, y ahí puede contradecirlos.

Lo que lo hace caro es la asimetría de las reglas del backlog: un `acceptance_criteria` **no se
puede reescribir** («si está mal, se agrega un feature nuevo que lo corrija»), mientras que el
`notes` no tiene ninguna protección. Así que resolver a favor de la prosa **obliga a abrir un
feature de corrección**, y resolver a favor de los criterios no cuesta nada.

## Solución

En F-037, el `arch-guardian` lo detectó al cerrar el contrato y **no eligió en silencio**: lo
escaló. El coordinador se lo planteó al humano con **las dos citas literales enfrentadas** y
diciendo qué criterios quedaban inalcanzables bajo cada lectura. El humano respondió: «realmente no
estoy seguro de la nota. Quiero darle mas peso a los criterios 7 y 8.»

La lectura que salva **los once** criterios era única: **lo que bloquea son los cobros ya recibidos,
no la deuda viva** (el criterio 6 ya lo apuntaba — «el dinero ya entro a la caja de otro periodo»).
Quedó fijada en el ADR 0133, y el criterio 5 se siembra con un **abono parcial**, que sigue siendo
«saldo vivo» sin contradecir a los otros dos.

## Cómo evitarlo

**Los `acceptance_criteria` pesan más que el `notes`.** Ante una contradicción, manda el criterio:
es la fuente que se escribió para ejecutarse y la que el backlog protege.

Pero no la resuelvas solo: **escala con las dos citas enfrentadas** y con la lista de qué criterios
quedan inalcanzables bajo cada lectura. Es información que el humano no tiene delante, y en F-037
bastó una pregunta para cerrarlo.

Y el efecto secundario que se olvida: cuando el humano decide, **el protocolo de verificación que
el `spec` ya escribió para los criterios afectados queda obsoleto**. En F-037 el del criterio 5
decía «sin ningún abono», y bajo la decisión nueva esa siembra debe hacer que el borrado
**proceda**. Si nadie avisa al `qa`, rechaza una implementación correcta — el mismo modo de fallo
que [[E-018]]: la redacción congelada de un criterio ejecutada contra una decisión posterior.
